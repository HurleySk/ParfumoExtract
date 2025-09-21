import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import axiosRetry from 'axios-retry';
import { config } from '../config';
import { crawlerLogger as logger } from '../utils/logger';

export class HttpClient {
  private axiosInstance: AxiosInstance;
  private lastRequestTime = 0;
  private requestCount = 0;
  private hourlyRequestCount = 0;
  private hourStart = Date.now();

  constructor() {
    this.axiosInstance = axios.create({
      timeout: config.crawler.timeoutMs,
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
    });

    axiosRetry(this.axiosInstance, {
      retries: config.crawler.maxRetries,
      retryDelay: (retryCount) => {
        return retryCount * 1000;
      },
      retryCondition: (error) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
               (error.response?.status ? error.response.status >= 500 : false);
      },
    });

    this.axiosInstance.interceptors.request.use(
      async (requestConfig) => {
        await this.enforceRateLimit();

        requestConfig.headers['User-Agent'] = config.crawler.userAgent;

        logger.debug(`Making request to: ${requestConfig.url}`);
        return requestConfig;
      },
      (error) => Promise.reject(error)
    );

    this.axiosInstance.interceptors.response.use(
      (response) => {
        logger.debug(`Response received: ${response.status} from ${response.config.url}`);
        return response;
      },
      (error) => {
        if (error.response) {
          logger.warn(`HTTP Error: ${error.response.status} from ${error.config?.url}`);
        } else {
          logger.error(`Network Error: ${error.message}`);
        }
        return Promise.reject(error);
      }
    );
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();

    if (now - this.hourStart > 3600000) {
      this.hourlyRequestCount = 0;
      this.hourStart = now;
    }

    if (this.hourlyRequestCount >= config.rateLimit.requestsPerHour) {
      const waitTime = 3600000 - (now - this.hourStart);
      logger.info(`Hourly rate limit reached, waiting ${waitTime}ms`);
      await this.delay(waitTime);
      this.hourlyRequestCount = 0;
      this.hourStart = Date.now();
    }

    const timeSinceLastRequest = now - this.lastRequestTime;
    const minDelay = config.crawler.delayMs;

    if (timeSinceLastRequest < minDelay) {
      const delayTime = minDelay - timeSinceLastRequest;
      await this.delay(delayTime);
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;
    this.hourlyRequestCount++;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async get(url: string, options?: AxiosRequestConfig): Promise<string> {
    try {
      const response = await this.axiosInstance.get(url, options);
      return response.data;
    } catch (error: any) {
      logger.error(`Failed to fetch ${url}: ${error.message}`);
      throw error;
    }
  }

  getStats() {
    return {
      totalRequests: this.requestCount,
      hourlyRequests: this.hourlyRequestCount,
      currentHourStart: new Date(this.hourStart).toISOString(),
    };
  }
}