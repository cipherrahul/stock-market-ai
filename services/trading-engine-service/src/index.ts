import dotenv from 'dotenv';
import { Pool } from 'pg';
import { createTradingEngineApp } from './app';
import { loadTradingConfig } from './config';

dotenv.config();

const config = loadTradingConfig();
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

const app = createTradingEngineApp(config, { db: pool });
const server = app.listen(config.port, () => {
  console.log(`${config.serviceName} listening on port ${config.port}`);
});

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down ${config.serviceName}`);
  server.close(async () => {
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
