export interface RuntimeConfig {
  port: number;
  serviceName: string;
  serviceVersion: string;
  cacheTtlSeconds: number;
  dbHost: string;
  dbPort: number;
  dbUser: string;
  dbPassword: string;
  dbName: string;
  redisUrl: string;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function numeric(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid numeric environment variable: ${name}`);
  }
  return parsed;
}

export function loadPortfolioConfig(): RuntimeConfig {
  return {
    port: numeric('PORT', 3005),
    serviceName: 'portfolio-service',
    serviceVersion: process.env.SERVICE_VERSION || '1.0.0',
    cacheTtlSeconds: numeric('PORTFOLIO_CACHE_TTL_SECONDS', 300),
    dbHost: required('DB_HOST'),
    dbPort: numeric('DB_PORT', 5432),
    dbUser: required('DB_USER'),
    dbPassword: required('DB_PASSWORD'),
    dbName: required('DB_NAME'),
    redisUrl: required('REDIS_URL'),
  };
}
