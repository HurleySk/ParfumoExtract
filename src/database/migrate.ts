import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { logger } from '../utils/logger';

async function runMigration() {
  const pool = new Pool({
    connectionString: config.database.url,
  });

  try {
    logger.info('Starting database migration...');

    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

    await pool.query(schemaSql);

    logger.info('Database migration completed successfully');
  } catch (error) {
    logger.error('Database migration failed', error);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runMigration().catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
}

export { runMigration };