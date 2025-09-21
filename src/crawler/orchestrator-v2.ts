import { HttpClient } from './http-client';
import { FragranceParserV3 } from './parser-v3';
import { FragranceRepository } from '../database/repository';
import { RateLimiter } from './rate-limiter';
import { RobotsChecker } from './robots-checker';
import { CrawlerOptions } from '../types';
import { config } from '../config';
import { crawlerLogger as logger } from '../utils/logger';
import { initDatabase, closeDatabase } from '../database/connection';
import { mockFragranceListHTML, mockFragrancePageHTML } from '../tests/mock-data';

export interface CrawlerOptionsV2 extends CrawlerOptions {
  testMode?: boolean;
  respectRobotsTxt?: boolean;
}

export class CrawlerOrchestratorV2 {
  private httpClient: HttpClient;
  private parser: FragranceParserV3;
  private repository: FragranceRepository;
  private rateLimiter: RateLimiter;
  private robotsChecker: RobotsChecker;
  private processedUrls = new Set<string>();
  private failedUrls = new Set<string>();
  private testMode = false;

  constructor() {
    this.httpClient = new HttpClient();
    this.parser = new FragranceParserV3();
    this.repository = new FragranceRepository();
    this.rateLimiter = new RateLimiter();
    this.robotsChecker = new RobotsChecker();
  }

  async initialize(): Promise<void> {
    await initDatabase();
    logger.info('Crawler V2 initialized with rate limiting and robots.txt compliance');
  }

  async crawl(options: CrawlerOptionsV2 = {}): Promise<void> {
    try {
      this.testMode = options.testMode || false;
      await this.initialize();

      if (this.testMode) {
        logger.info('Running in TEST MODE with mock data');
        await this.runTestMode();
        return;
      }

      // Use the search endpoint which provides better structured results
      const startUrl = options.startUrl || `${config.crawler.baseUrl}/s_perfumes_x.php?g_m=1&g_f=1&g_u=1`;
      logger.info(`Starting production crawl from: ${startUrl}`);

      // Check robots.txt compliance
      if (options.respectRobotsTxt !== false) {
        const canCrawl = await this.robotsChecker.canFetch(startUrl);
        if (!canCrawl) {
          throw new Error(`Crawling ${startUrl} is disallowed by robots.txt`);
        }
      }

      const fragranceUrls = await this.discoverFragrances(startUrl, options);
      logger.info(`Found ${fragranceUrls.length} fragrances to crawl`);

      await this.processFragrances(fragranceUrls, options);

      const stats = this.rateLimiter.getStats();
      logger.info(`Crawl completed - processed: ${this.processedUrls.size}, failed: ${this.failedUrls.size}`);
      logger.info(`Rate limiter stats - done: ${stats.done}, queued: ${stats.queued}`);
    } catch (error) {
      logger.error(`Crawl failed: ${error}`);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  private async runTestMode(): Promise<void> {
    logger.info('Testing parser with mock HTML data...');

    // Test list page parsing
    const urls = this.parser.parseSearchResultsPage(mockFragranceListHTML);
    logger.info(`Parsed ${urls.length} URLs from mock list page`);
    urls.forEach(url => logger.info(`  - ${url}`));

    // Test fragrance page parsing
    const testUrl = 'https://www.parfumo.com/perfume/Creed/Aventus-9012.html';
    const result = this.parser.parseFragrancePage(mockFragrancePageHTML, testUrl);

    if (result) {
      logger.info('Successfully parsed mock fragrance:');
      logger.info(`  Name: ${result.fragrance.name}`);
      logger.info(`  Brand: ${result.brand.name}`);
      logger.info(`  Year: ${result.fragrance.releaseYear}`);
      logger.info(`  Rating: ${result.fragrance.ratingValue} (${result.fragrance.ratingCount} votes)`);
      logger.info(`  Top Notes: ${result.notes.top.join(', ')}`);
      logger.info(`  Middle Notes: ${result.notes.middle.join(', ')}`);
      logger.info(`  Base Notes: ${result.notes.base.join(', ')}`);
      logger.info(`  Perfumers: ${result.perfumers.join(', ')}`);
      logger.info(`  Accords: ${result.accords.map(a => `${a.name}(${a.strength}%)`).join(', ')}`);

      // Save to database
      const fragranceId = await this.repository.saveFragrance(result);
      if (fragranceId) {
        logger.info(`Successfully saved mock fragrance to database with ID: ${fragranceId}`);
      }
    } else {
      logger.error('Failed to parse mock fragrance page');
    }
  }

  private async discoverFragrances(
    startUrl: string,
    options: CrawlerOptionsV2
  ): Promise<string[]> {
    const allUrls: string[] = [];
    const pagesToCrawl = options.maxPages || 10;
    let currentPage = 1;

    while (currentPage <= pagesToCrawl) {
      try {
        const pageUrl = currentPage === 1 ? startUrl : `${startUrl}&current_page=${currentPage}`;

        // Check robots.txt for each page
        if (options.respectRobotsTxt !== false) {
          const canCrawl = await this.robotsChecker.canFetch(pageUrl);
          if (!canCrawl) {
            logger.warn(`Skipping ${pageUrl} due to robots.txt`);
            currentPage++;
            continue;
          }
        }

        logger.info(`Discovering fragrances on page ${currentPage}: ${pageUrl}`);

        // Use rate limiter to schedule the request
        const html = await this.rateLimiter.scheduleWithRetry(
          () => this.httpClient.get(pageUrl),
          5,
          `discover-page-${currentPage}`
        );

        const urls = this.parser.parseSearchResultsPage(html);

        if (urls.length === 0) {
          logger.info('No more fragrances found, stopping discovery');
          break;
        }

        allUrls.push(...urls);
        currentPage++;

        await this.repository.saveCrawlHistory({
          url: pageUrl,
          status: 'success',
          itemsExtracted: urls.length,
          createdAt: new Date(),
        });
      } catch (error: any) {
        logger.error(`Failed to discover fragrances on page ${currentPage}: ${error.message}`);

        await this.repository.saveCrawlHistory({
          url: `${startUrl}?page=${currentPage}`,
          status: 'failed',
          errorMessage: error.message,
          createdAt: new Date(),
        });

        if (currentPage === 1) {
          throw error;
        }
        break;
      }
    }

    const uniqueUrls = Array.from(new Set(allUrls));
    logger.info(`Discovered ${uniqueUrls.length} unique fragrance URLs`);
    return uniqueUrls;
  }

  private async processFragrances(
    urls: string[],
    options: CrawlerOptionsV2
  ): Promise<void> {
    for (const url of urls) {
      await this.processFragrance(url, options);
    }
  }

  private async processFragrance(
    url: string,
    options: CrawlerOptionsV2
  ): Promise<void> {
    if (this.processedUrls.has(url)) {
      logger.debug(`Already processed: ${url}`);
      return;
    }

    const startTime = Date.now();

    try {
      const parfumoId = this.extractParfumoId(url);

      if (options.skipExisting && await this.repository.fragranceExists(parfumoId)) {
        logger.debug(`Fragrance already exists in database: ${parfumoId}`);
        this.processedUrls.add(url);
        return;
      }

      // Check robots.txt
      if (options.respectRobotsTxt !== false) {
        const canCrawl = await this.robotsChecker.canFetch(url);
        if (!canCrawl) {
          logger.warn(`Skipping ${url} due to robots.txt`);
          return;
        }
      }

      // Skip brand-only pages
      if (url.endsWith('/Perfumes') || url.match(/\/Perfumes\/[^\/]+\/?$/)) {
        logger.info(`Skipping brand overview page: ${url}`);
        return;
      }

      logger.info(`Processing fragrance: ${url}`);

      // Use rate limiter to schedule the request with higher priority for individual fragrances
      const html = await this.rateLimiter.scheduleWithRetry(
        () => this.httpClient.get(url),
        3,
        `fragrance-${parfumoId}`
      );

      const data = this.parser.parseFragrancePage(html, url);

      if (data) {
        const fragranceId = await this.repository.saveFragrance(data);

        if (fragranceId) {
          this.processedUrls.add(url);
          logger.info(`Successfully saved fragrance: ${data.fragrance.name}`);

          // Log extracted details for verification
          logger.debug(`  Brand: ${data.brand.name}`);
          logger.debug(`  Year: ${data.fragrance.releaseYear || 'N/A'}`);
          logger.debug(`  Rating: ${data.fragrance.ratingValue || 'N/A'} (${data.fragrance.ratingCount || 0} votes)`);
          logger.debug(`  Longevity: ${data.fragrance.longevityRating || 'N/A'}`);
          logger.debug(`  Sillage: ${data.fragrance.sillageRating || 'N/A'}`);
          logger.debug(`  Notes - Top: ${data.notes.top.length}, Middle: ${data.notes.middle.length}, Base: ${data.notes.base.length}`);

          await this.repository.saveCrawlHistory({
            url,
            status: 'success',
            itemsExtracted: 1,
            durationMs: Date.now() - startTime,
            createdAt: new Date(),
          });
        }
      } else {
        throw new Error('Failed to parse fragrance data');
      }
    } catch (error: any) {
      this.failedUrls.add(url);
      logger.error(`Failed to process fragrance ${url}: ${error.message}`);

      await this.repository.saveCrawlHistory({
        url,
        status: 'failed',
        errorMessage: error.message,
        durationMs: Date.now() - startTime,
        createdAt: new Date(),
      });
    }
  }

  private extractParfumoId(url: string): string {
    const match = url.match(/\/([^\/]+)\.html$/);
    return match ? match[1] : url.split('/').pop() || '';
  }

  private async cleanup(): Promise<void> {
    await this.rateLimiter.drain();
    await closeDatabase();
    logger.info('Cleanup completed');
  }
}

async function main() {
  const orchestrator = new CrawlerOrchestratorV2();

  // Check command line arguments
  const args = process.argv.slice(2);
  const isTestMode = args.includes('--test');

  if (isTestMode) {
    logger.info('Running in test mode with mock data');
    await orchestrator.crawl({
      testMode: true,
    });
  } else {
    await orchestrator.crawl({
      maxPages: 30,
      skipExisting: true,
      respectRobotsTxt: true,
    });
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}