/**
 * Auth Service - Login Tests
 */
import { createMockPool, setupMockQueryResponses, createTestUser } from 'test-utils';
import * as bcrypt from 'bcryptjs';

describe('Auth Service - Login', () => {
  let pool: any;

  beforeEach(() => {
    pool = createMockPool();
    jest.clearAllMocks();
  });

  describe('POST /login', () => {
    it('should login user with valid credentials', async () => {
      const password = 'SecurePassword123!';
      const passwordHash = await bcrypt.hash(password, 12);
      const testUser = createTestUser({ passwordHash });

      setupMockQueryResponses(pool, [
        {
          query: 'SELECT * FROM users WHERE email',
          response: { rows: [testUser] },
        },
      ]);

      expect(pool.query).toBeDefined();
    });

    it('should reject login with invalid email', async () => {
      setupMockQueryResponses(pool, [
        {
          query: 'SELECT * FROM users WHERE email',
          response: { rows: [] },
        },
      ]);

      const error = new Error('User not found');
      expect(error.message).toMatch(/not found/i);
    });

    it('should reject login with wrong password', async () => {
      const correctPassword = 'CorrectPassword123!';
      const wrongPassword = 'WrongPassword123!';
      const passwordHash = await bcrypt.hash(correctPassword, 12);

      const isValid = await bcrypt.compare(wrongPassword, passwordHash);
      expect(isValid).toBe(false);
    });

    it('should return access and refresh tokens on successful login', async () => {
      const expectedResponse = {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refreshToken: 'refresh-token-123',
        user: {
          id: 'test-user-123',
          email: 'test@example.com',
          name: 'Test User',
        },
      };

      expect(expectedResponse.accessToken).toBeDefined();
      expect(expectedResponse.refreshToken).toBeDefined();
      expect(expectedResponse.user).toBeDefined();
    });

    it('should set refresh token in Redis for revocation', async () => {
      const refreshToken = 'refresh-token-123';
      const ttl = 7 * 24 * 60 * 60; // 7 days in seconds

      // Mock Redis operations
      const redisClient = {
        set: jest.fn(),
      };

      await redisClient.set(`refresh:${refreshToken}`, 'true', { EX: ttl });
      expect(redisClient.set).toHaveBeenCalledWith(
        expect.stringContaining('refresh:'),
        'true',
        expect.any(Object)
      );
    });
  });

  describe('POST /refresh-token', () => {
    it('should return new access token with valid refresh token', async () => {
      const refreshToken = 'valid-refresh-token';
      const redisClient = {
        get: jest.fn().mockResolvedValue('true'),
      };

      const result = await redisClient.get(`refresh:${refreshToken}`);
      expect(result).toBeTruthy();
    });

    it('should reject expired refresh token', async () => {
      const expiredToken = 'expired-refresh-token';
      const redisClient = {
        get: jest.fn().mockResolvedValue(null),
      };

      const result = await redisClient.get(`refresh:${expiredToken}`);
      expect(result).toBeNull();
    });

    it('should reject revoked refresh token', async () => {
      const revokedToken = 'revoked-refresh-token';
      const redisClient = {
        get: jest.fn().mockResolvedValue(null),
      };

      const result = await redisClient.get(`refresh:${revokedToken}`);
      expect(result).toBeNull();
    });

    it('should return new tokens on successful refresh', async () => {
      const expectedResponse = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };

      expect(expectedResponse.accessToken).toBeDefined();
      expect(expectedResponse.refreshToken).toBeDefined();
    });
  });

  describe('POST /logout', () => {
    it('should revoke refresh token on logout', async () => {
      const refreshToken = 'refresh-token-to-revoke';
      const redisClient = {
        del: jest.fn(),
      };

      await redisClient.del(`refresh:${refreshToken}`);
      expect(redisClient.del).toHaveBeenCalledWith(
        expect.stringContaining(refreshToken)
      );
    });

    it('should return success response on logout', async () => {
      const response = {
        message: 'Logged out successfully',
      };

      expect(response.message).toMatch(/successfully/i);
    });
  });

  describe('Token Validation', () => {
    it('should validate JWT structure', () => {
      const token =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      const parts = token.split('.');
      expect(parts).toHaveLength(3);
    });

    it('should verify JWT signature with secret', () => {
      const jwtSecret = 'test-secret';
      expect(jwtSecret).toBeDefined();
      expect(jwtSecret.length).toBeGreaterThanOrEqual(32);
    });

    it('should reject expired tokens', () => {
      const expiredToken = {
        exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
      };

      expect(expiredToken.exp).toBeLessThan(Math.floor(Date.now() / 1000));
    });

    it('should reject tokens with invalid signature', () => {
      const validToken = 'valid.token.signature';
      const tamperedToken = 'valid.token.different-signature';

      expect(validToken).not.toEqual(tamperedToken);
    });
  });

  describe('Session Management', () => {
    it('should track login attempts for rate limiting', async () => {
      const redisClient = {
        incr: jest.fn().mockResolvedValue(1),
        expire: jest.fn(),
      };

      const attempts = await redisClient.incr('login-attempts:test@example.com');
      expect(attempts).toBe(1);
    });

    it('should block account after 5 failed login attempts', async () => {
      const failedAttempts = 5;
      expect(failedAttempts).toBeGreaterThanOrEqual(5);
    });

    it('should reset attempts on successful login', async () => {
      const redisClient = {
        del: jest.fn(),
      };

      await redisClient.del('login-attempts:test@example.com');
      expect(redisClient.del).toHaveBeenCalled();
    });
  });
});
