import dotenv from 'dotenv';
import { Pool } from 'pg';
import { createClient } from 'redis';
import { createPortfolioApp } from './app';
import { loadPortfolioConfig } from './config';

dotenv.config();

const config = loadPortfolioConfig();
const pool = new Pool({
  host: config.dbHost,
  port: config.dbPort,
  user: config.dbUser,
  password: config.dbPassword,
  database: config.dbName,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  application_name: config.serviceName,
});

const cache = createClient({ url: config.redisUrl });
cache.on('error', (error) => {
  console.error(`portfolio-service cache error: ${error.message}`);
});

void cache.connect().catch((error) => {
  console.error(`portfolio-service cache connect failed: ${error.message}`);
});

const app = createPortfolioApp(config, { db: pool, cache });
const server = app.listen(config.port, () => {
  console.log(`${config.serviceName} listening on port ${config.port}`);
});

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down ${config.serviceName}`);
  server.close(async () => {
    if (cache.isOpen) {
      await cache.quit();
    }
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

export default app;
