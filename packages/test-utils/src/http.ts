/**
 * Test utilities for HTTP request testing
 */
import { Express } from 'express';
import request from 'supertest';

export interface TestRequest {
  get: (path: string) => request.Test;
  post: (path: string) => request.Test;
  put: (path: string) => request.Test;
  delete: (path: string) => request.Test;
  patch: (path: string) => request.Test;
}

/**
 * Create a test request helper for an Express app
 */
export function createTestRequest(app: Express): TestRequest {
  return {
    get: (path: string) => request(app).get(path),
    post: (path: string) => request(app).post(path),
    put: (path: string) => request(app).put(path),
    delete: (path: string) => request(app).delete(path),
    patch: (path: string) => request(app).patch(path),
  };
}

/**
 * Helper to make authenticated requests
 */
export async function makeAuthenticatedRequest(
  req: request.Test,
  token: string
): Promise<request.Test> {
  return req.set('Authorization', `Bearer ${token}`);
}

/**
 * Helper to make requests with custom headers
 */
export async function makeRequestWithHeaders(
  req: request.Test,
  headers: Record<string, string>
): Promise<request.Test> {
  let result = req;
  for (const [key, value] of Object.entries(headers)) {
    result = result.set(key, value);
  }
  return result;
}

/**
 * Mock JWT token generator for testing
 */
export function generateMockJWT(payload: any = {}): string {
  // This is a simple mock. In real tests, jwt.sign would be used
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString(
    'base64'
  );
  const body = Buffer.from(JSON.stringify(payload)).toString('base64');
  return `${header}.${body}.mock-signature`;
}
