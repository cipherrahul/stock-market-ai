import { createMockPool } from '../../../../packages/test-utils/src/database';
import * as http from 'http';
import { AddressInfo } from 'net';
import { createPortfolioApp } from '../app';

async function makeRequest(
  app: ReturnType<typeof createPortfolioApp>,
  method: string,
  path: string,
  options?: { headers?: Record<string, string>; body?: unknown }
) {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));

  try {
    const address = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(options?.headers || {}),
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    return {
      status: response.status,
      body: await response.json(),
    };
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

describe('Portfolio Service - Portfolio Management', () => {
  const config = {
    port: 3005,
    serviceName: 'portfolio-service',
    serviceVersion: '1.0.0',
    cacheTtlSeconds: 60,
  };

  let pool: ReturnType<typeof createMockPool>;
  let cache: {
    get: jest.Mock;
    setEx: jest.Mock;
    ping: jest.Mock;
  };

  beforeEach(() => {
    pool = createMockPool();
    cache = {
      get: jest.fn(),
      setEx: jest.fn(),
      ping: jest.fn().mockResolvedValue('PONG'),
    };
    jest.clearAllMocks();
  });

  it('returns cached portfolio when present', async () => {
    cache.get.mockResolvedValueOnce(
      JSON.stringify({ userId: 'user-1', balance: 1500, totalValue: 1500, positions: [] })
    );

    const app = createPortfolioApp(config, { db: pool, cache });
    const response = await makeRequest(app, 'GET', '/api/v1/portfolio/user-1', {
      headers: { 'x-user-id': 'user-1' },
    });

    expect(response.status).toBe(200);
    expect(response.body.balance).toBe(1500);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('blocks cross-user portfolio access', async () => {
    const app = createPortfolioApp(config, { db: pool, cache });
    const response = await makeRequest(app, 'GET', '/api/v1/portfolio/user-1', {
      headers: { 'x-user-id': 'user-2' },
    });

    expect(response.status).toBe(403);
    expect(response.body.errorCode).toBe('FORBIDDEN');
  });

  it('builds portfolio from database state and stores it in cache', async () => {
    cache.get.mockResolvedValueOnce(null);
    pool.query
      .mockResolvedValueOnce({
        rows: [{ symbol: 'AAPL', quantity: '2', avg_price: '100' }],
      })
      .mockResolvedValueOnce({
        rows: [{ cash: '500' }],
      });

    const app = createPortfolioApp(config, { db: pool, cache });
    const response = await makeRequest(app, 'GET', '/api/v1/portfolio/user-1', {
      headers: { 'x-user-id': 'user-1' },
    });

    expect(response.status).toBe(200);
    expect(response.body.totalValue).toBe(700);
    expect(cache.setEx).toHaveBeenCalled();
  });

  it('validates deposit payloads before opening a transaction', async () => {
    const app = createPortfolioApp(config, { db: pool, cache });
    const response = await makeRequest(app, 'POST', '/api/v1/portfolio/deposit', {
      body: { userId: 'user-1', amount: -10 },
    });

    expect(response.status).toBe(400);
    expect(response.body.errorCode).toBe('VALIDATION_ERROR');
  });

  it('commits a valid deposit transaction', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({}),
      release: jest.fn(),
    };
    const transactionalDb = {
      ...pool,
      connect: jest.fn().mockResolvedValue(client),
    };

    const app = createPortfolioApp(config, { db: transactionalDb, cache });
    const response = await makeRequest(app, 'POST', '/api/v1/portfolio/deposit', {
      body: { userId: 'user-1', amount: 100, currency: 'usd' },
    });

    expect(response.status).toBe(200);
    expect(client.query).toHaveBeenCalledWith('BEGIN');
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();
  });

  it('reports unhealthy when database health check fails', async () => {
    pool.query.mockRejectedValueOnce(new Error('db down'));

    const app = createPortfolioApp(config, { db: pool, cache });
    const response = await makeRequest(app, 'GET', '/health');

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('unhealthy');
  });
});
