import { HttpClient } from './http-client';
import { FragranceParser } from './parser';
import { FragranceRepository } from '../database/repository';
import { CrawlerOptions } from '../types';
import { config } from '../config';
import { crawlerLogger as logger } from '../utils/logger';
import { initDatabase, closeDatabase } from '../database/connection';

export class CrawlerOrchestrator {
  private httpClient: HttpClient;
  private parser: FragranceParser;
  private repository: FragranceRepository;
  private processedUrls = new Set<string>();
  private failedUrls = new Set<string>();

  constructor() {
    this.httpClient = new HttpClient();
    this.parser = new FragranceParser();
    this.repository = new FragranceRepository();
  }

  async initialize(): Promise<void> {
    await initDatabase();
    logger.info('Crawler initialized successfully');
  }

  async crawl(options: CrawlerOptions = {}): Promise<void> {
    try {
      await this.initialize();

      const startUrl = options.startUrl || `${config.crawler.baseUrl}/en/perfumes`;
      logger.info(`Starting crawl from: ${startUrl}`);

      const fragranceUrls = await this.discoverFragrances(startUrl, options);
      logger.info(`Found ${fragranceUrls.length} fragrances to crawl`);

      await this.processFragrances(fragranceUrls, options);

      const stats = this.httpClient.getStats();
      logger.info(`Crawl completed - processed: ${this.processedUrls.size}, failed: ${this.failedUrls.size}, totalRequests: ${stats.totalRequests}`);
    } catch (error) {
      logger.error(`Crawl failed: ${error}`);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  private async discoverFragrances(
    startUrl: string,
    options: CrawlerOptions
  ): Promise<string[]> {
    const allUrls: string[] = [];
    const pagesToCrawl = options.maxPages || 10;
    let currentPage = 1;

    while (currentPage <= pagesToCrawl) {
      try {
        const pageUrl = currentPage === 1 ? startUrl : `${startUrl}?page=${currentPage}`;
        logger.info(`Discovering fragrances on page ${currentPage}: ${pageUrl}`);

        const html = await this.httpClient.get(pageUrl);
        const urls = this.parser.parseListPage(html);

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
        logger.error(`Failed to discover fragrances on page ${currentPage}`, error);

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
    options: CrawlerOptions
  ): Promise<void> {
    // Process sequentially to respect rate limits
    for (const url of urls) {
      await this.processFragrance(url, options);
    }
  }

  private async processFragrance(
    url: string,
    options: CrawlerOptions
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

      logger.info(`Processing fragrance: ${url}`);
      const html = await this.httpClient.get(url);
      const data = this.parser.parseFragrancePage(html, url);

      if (data) {
        const fragranceId = await this.repository.saveFragrance(data);

        if (fragranceId) {
          this.processedUrls.add(url);
          logger.info(`Successfully saved fragrance: ${data.fragrance.name}`);

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
      logger.error(`Failed to process fragrance: ${url}`, error);

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
    await closeDatabase();
    logger.info('Cleanup completed');
  }
}

async function main() {
  const orchestrator = new CrawlerOrchestrator();

  await orchestrator.crawl({
    maxPages: 5,
    skipExisting: true,
  });
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}