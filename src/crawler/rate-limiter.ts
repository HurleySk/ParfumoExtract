import Bottleneck from 'bottleneck';
import { config } from '../config';
import { crawlerLogger as logger } from '../utils/logger';

export class RateLimiter {
  private limiter: Bottleneck;

  constructor() {
    // Bottleneck configuration for respectful crawling
    this.limiter = new Bottleneck({
      // Maximum 2 concurrent requests
      maxConcurrent: config.crawler.concurrentRequests,

      // Minimum time between requests (in ms)
      minTime: config.crawler.delayMs,

      // Rate limiting: requests per minute
      reservoir: config.rateLimit.requestsPerMinute,
      reservoirRefreshAmount: config.rateLimit.requestsPerMinute,
      reservoirRefreshInterval: 60 * 1000, // 1 minute

      // Retry configuration
      retryLimit: config.crawler.maxRetries,

      // High priority for important requests
      highWater: 100,

      // Strategy for handling rate limit errors
      strategy: Bottleneck.strategy.LEAK,
    });

    // Track statistics
    this.limiter.on('executing', (jobInfo) => {
      logger.debug(`Executing job ${jobInfo.options.id} - Queue size: ${this.limiter.queued()}`);
    });

    this.limiter.on('done', (jobInfo) => {
      logger.debug(`Completed job ${jobInfo.options.id}`);
    });

    this.limiter.on('failed', (error, jobInfo) => {
      logger.warn(`Job ${jobInfo.options.id} failed: ${error.message}`);

      if (jobInfo.retryCount < config.crawler.maxRetries) {
        const delay = this.calculateBackoff(jobInfo.retryCount);
        logger.info(`Retrying job ${jobInfo.options.id} in ${delay}ms (attempt ${jobInfo.retryCount + 1})`);
        return delay;
      }
      return 0; // Don't retry (0 means no retry, not -1)
    });

    this.limiter.on('retry', (message, jobInfo) => {
      logger.info(`Retrying job ${jobInfo.options.id}: ${message}`);
    });
  }

  private calculateBackoff(retryCount: number): number {
    // Exponential backoff with jitter
    const baseDelay = 1000;
    const maxDelay = 30000;
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
    const jitter = Math.random() * 1000;
    return exponentialDelay + jitter;
  }

  async schedule<T>(fn: () => Promise<T>, priority = 5, id?: string): Promise<T> {
    return this.limiter.schedule({ priority, id }, fn);
  }

  async scheduleWithRetry<T>(
    fn: () => Promise<T>,
    priority = 5,
    id?: string
  ): Promise<T> {
    return this.limiter.schedule({ priority, id, expiration: 60000 }, async () => {
      try {
        return await fn();
      } catch (error: any) {
        // Check if it's a rate limit error
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'];
          if (retryAfter) {
            const delay = parseInt(retryAfter) * 1000;
            logger.warn(`Rate limited. Waiting ${delay}ms before retry`);
            await this.delay(delay);
          }
        }
        throw error;
      }
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStats() {
    return {
      running: this.limiter.running(),
      queued: this.limiter.queued(),
      done: this.limiter.done(),
    };
  }

  async drain(): Promise<void> {
    await this.limiter.stop();
    await this.limiter.disconnect();
  }
}