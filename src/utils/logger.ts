import pino from 'pino';
import { config } from '../config';
import fs from 'fs';
import path from 'path';

const logDir = path.dirname(config.logging.file);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const targets: any[] = [];

if (!config.isProduction) {
  targets.push({
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  });
}

if (config.isProduction) {
  targets.push({
    target: 'pino/file',
    options: { destination: config.logging.file },
  });
}

export const logger = pino({
  level: config.logging.level,
  transport: {
    targets,
  },
});

export const crawlerLogger = logger.child({ module: 'crawler' });
export const dbLogger = logger.child({ module: 'database' });
export const parserLogger = logger.child({ module: 'parser' });