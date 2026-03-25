/**
 * Test utilities for database mocking and setup
 */
import { Pool, PoolClient } from 'pg';

export interface MockPool {
  query: jest.MockedFunction<any>;
  connect: jest.Mock;
  end: jest.Mock;
}

/**
 * Create a mock PostgreSQL pool for testing
 */
export function createMockPool(): MockPool {
  return {
    query: jest.fn(),
    connect: jest.fn(),
    end: jest.fn(),
  };
}

/**
 * Mock pool client for transaction testing
 */
export function createMockPoolClient(): PoolClient {
  return {
    query: jest.fn(),
    release: jest.fn(),
    end: jest.fn(),
  } as any;
}

/**
 * Helper to setup mock query responses
 */
export function setupMockQueryResponse(
  pool: MockPool,
  query: string,
  response: any
) {
  pool.query.mockImplementation((sql: string) => {
    if (sql.includes(query)) {
      return Promise.resolve(response);
    }
    return Promise.reject(new Error(`Unexpected query: ${sql}`));
  });
}

/**
 * Helper to setup multiple query responses
 */
export function setupMockQueryResponses(
  pool: MockPool,
  responses: Array<{ query: string; response: any }>
) {
  pool.query.mockImplementation((sql: string) => {
    for (const { query, response } of responses) {
      if (sql.includes(query)) {
        return Promise.resolve(response);
      }
    }
    return Promise.reject(new Error(`Unexpected query: ${sql}`));
  });
}
