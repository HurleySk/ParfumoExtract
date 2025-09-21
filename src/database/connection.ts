import { Pool, PoolClient } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';

let pool: Pool;

export const initDatabase = async (): Promise<void> => {
  try {
    pool = new Pool({
      connectionString: config.database.url,
      max: config.database.maxConnections,
      idleTimeoutMillis: config.database.idleTimeoutMillis,
      connectionTimeoutMillis: config.database.connectionTimeoutMillis,
    });

    pool.on('error', (err) => {
      logger.error(`Unexpected database error: ${err}`);
    });

    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();

    logger.info('Database connection established successfully');
  } catch (error) {
    logger.error(`Failed to connect to database: ${error}`);
    throw error;
  }
};

export const getConnection = async (): Promise<PoolClient> => {
  if (!pool) {
    await initDatabase();
  }
  return pool.connect();
};

export const query = async (text: string, params?: any[]): Promise<any> => {
  if (!pool) {
    await initDatabase();
  }
  return pool.query(text, params);
};

export const transaction = async <T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const client = await getConnection();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const closeDatabase = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    logger.info('Database connection closed');
  }
};