import { CrawlerOrchestrator } from './crawler/orchestrator';
import { CrawlerOptions } from './types';
import { logger } from './utils/logger';
import { config } from './config';

export { CrawlerOrchestrator } from './crawler/orchestrator';
export { FragranceRepository } from './database/repository';
export * from './types';

async function main() {
  const args = process.argv.slice(2);
  const options: CrawlerOptions = {};

  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];

    switch (flag) {
      case '--max-pages':
        options.maxPages = parseInt(value);
        break;
      case '--start-url':
        options.startUrl = value;
        break;
      case '--skip-existing':
        options.skipExisting = value === 'true';
        break;
      case '--category':
        options.categoryFilter = value.split(',');
        break;
      default:
        logger.warn(`Unknown flag: ${flag}`);
    }
  }

  logger.info(`ParfumoExtract Crawler Starting - version: 1.0.0, environment: ${config.env}`);

  const orchestrator = new CrawlerOrchestrator();

  try {
    await orchestrator.crawl(options);
    logger.info('Crawl completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error(`Crawl failed with error: ${error}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}