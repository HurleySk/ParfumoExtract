import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  database: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/parfumo_db',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    name: process.env.DB_NAME || 'parfumo_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    maxConnections: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },

  crawler: {
    userAgent: process.env.CRAWLER_USER_AGENT || 'ParfumoExtract/1.0 (Educational Purpose)',
    delayMs: parseInt(process.env.CRAWLER_DELAY_MS || '2000'),
    maxRetries: parseInt(process.env.CRAWLER_MAX_RETRIES || '3'),
    timeoutMs: parseInt(process.env.CRAWLER_TIMEOUT_MS || '30000'),
    concurrentRequests: parseInt(process.env.CRAWLER_CONCURRENT_REQUESTS || '2'),
    baseUrl: 'https://www.parfumo.com',
  },

  rateLimit: {
    requestsPerMinute: parseInt(process.env.RATE_LIMIT_REQUESTS_PER_MINUTE || '30'),
    requestsPerHour: parseInt(process.env.RATE_LIMIT_REQUESTS_PER_HOUR || '1000'),
  },

  cache: {
    ttlHours: parseInt(process.env.CACHE_TTL_HOURS || '24'),
    enabled: process.env.ENABLE_CACHE === 'true',
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || path.join(process.cwd(), 'logs', 'crawler.log'),
  },

  env: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV !== 'production',
  isProduction: process.env.NODE_ENV === 'production',
};