import {
  createMockHttpClient,
} from '../../../../packages/test-utils/src/mocks';
import { createMockPool } from '../../../../packages/test-utils/src/database';
import * as http from 'http';
import { AddressInfo } from 'net';
import { createTradingEngineApp } from '../app';

async function makeRequest(
  app: ReturnType<typeof createTradingEngineApp>,
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

describe('Trading Engine - Trade Execution', () => {
  const config = {
    maxPositionSize: 10000,
    port: 3006,
    portfolioServiceUrl: 'http://portfolio-service',
    brokerServiceUrl: 'http://broker-service',
    serviceName: 'trading-engine-service',
    serviceVersion: '1.0.0',
    requestTimeoutMs: 1000,
  };

  let pool: ReturnType<typeof createMockPool>;
  let httpClient: ReturnType<typeof createMockHttpClient>;

  beforeEach(() => {
    pool = createMockPool();
    httpClient = createMockHttpClient();
    jest.clearAllMocks();
  });

  it('rejects trade execution without idempotency key', async () => {
    const app = createTradingEngineApp(config, { db: pool, httpClient });
    const response = await makeRequest(app, 'POST', '/api/v1/trading/execute', {
      body: { userId: 'user-1', symbol: 'AAPL', quantity: 1, side: 'BUY', price: 100 },
    });

    expect(response.status).toBe(400);
    expect(response.body.errorCode).toBe('VALIDATION_ERROR');
  });

  it('returns existing order for duplicate idempotency key', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'order-1', broker_order_id: 'broker-1', status: 'EXECUTED' }],
    });

    const app = createTradingEngineApp(config, { db: pool, httpClient });
    const response = await makeRequest(app, 'POST', '/api/v1/trading/execute', {
      headers: { 'Idempotency-Key': 'dup-1' },
      body: { userId: 'user-1', symbol: 'AAPL', quantity: 1, side: 'BUY', price: 100 },
    });

    expect(response.status).toBe(200);
    expect(response.body.duplicate).toBe(true);
    expect(httpClient.get).not.toHaveBeenCalled();
  });

  it('rejects buy orders without sufficient balance', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    httpClient.get.mockResolvedValueOnce({
      status: 200,
      data: { balance: 50, positions: [] },
    });

    const app = createTradingEngineApp(config, { db: pool, httpClient });
    const response = await makeRequest(app, 'POST', '/api/v1/trading/execute', {
      headers: { 'Idempotency-Key': 'buy-1' },
      body: { userId: 'user-1', symbol: 'AAPL', quantity: 1, side: 'BUY', price: 100 },
    });

    expect(response.status).toBe(400);
    expect(response.body.errorCode).toBe('INSUFFICIENT_BALANCE');
  });

  it('rejects sell orders when holdings are insufficient', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    httpClient.get.mockResolvedValueOnce({
      status: 200,
      data: { balance: 1000, positions: [{ symbol: 'AAPL', quantity: 1 }] },
    });

    const app = createTradingEngineApp(config, { db: pool, httpClient });
    const response = await makeRequest(app, 'POST', '/api/v1/trading/execute', {
      headers: { 'Idempotency-Key': 'sell-1' },
      body: { userId: 'user-1', symbol: 'AAPL', quantity: 2, side: 'SELL', price: 100 },
    });

    expect(response.status).toBe(400);
    expect(response.body.errorCode).toBe('INSUFFICIENT_HOLDINGS');
  });

  it('creates a new executed order when dependencies succeed', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'order-2', broker_order_id: 'broker-2', status: 'EXECUTED' }] });
    httpClient.get.mockResolvedValueOnce({
      status: 200,
      data: { balance: 1000, positions: [] },
    });
    httpClient.post.mockResolvedValueOnce({
      status: 200,
      data: { orderId: 'broker-2' },
    });

    const app = createTradingEngineApp(config, { db: pool, httpClient });
    const response = await makeRequest(app, 'POST', '/api/v1/trading/execute', {
      headers: { 'Idempotency-Key': 'new-1' },
      body: { userId: 'user-1', symbol: 'AAPL', quantity: 2, side: 'BUY', price: 100 },
    });

    expect(response.status).toBe(201);
    expect(response.body.orderId).toBe('order-2');
    expect(httpClient.post).toHaveBeenCalled();
  });

  it('reports not ready when database health check fails', async () => {
    pool.query.mockRejectedValueOnce(new Error('db down'));

    const app = createTradingEngineApp(config, { db: pool, httpClient });
    const response = await makeRequest(app, 'GET', '/ready');

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('not_ready');
  });
});
