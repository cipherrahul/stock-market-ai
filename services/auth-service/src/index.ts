import express, { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { createClient } from 'redis';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// ============================================================================
// PRODUCTION SETUP VALIDATION
// ============================================================================
const requiredEnvVars = [
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'REDIS_URL',
];

const missingEnvVars = requiredEnvVars.filter((varName) => !process.env[varName]);
if (missingEnvVars.length > 0) {
  console.error(`❌ FATAL: Missing required environment variables: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

// ============================================================================
// SECURITY MIDDLEWARE
// ============================================================================
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    dnsPrefetchControl: true,
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    ieNoOpen: true,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true,
  })
);

app.use(
  cors({
    origin: (process.env.CORS_ORIGIN || 'http://localhost:3002').split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID'],
    maxAge: 86400,
  })
);

app.use(express.json({ limit: process.env.BODY_LIMIT || '1mb' }));
app.use(express.urlencoded({ limit: process.env.BODY_LIMIT || '1mb', extended: true }));

// Request ID middleware for correlation
app.use((req: Request, res: Response, next: NextFunction) => {
  req.id = req.headers['x-request-id'] as string || crypto.randomUUID();
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logLevel = res.statusCode >= 400 ? 'WARN' : 'INFO';
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: logLevel,
        requestId: req.id,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
      })
    );
  });
  next();
});

// ============================================================================
// RATE LIMITING
// ============================================================================
const authLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_AUTH_MAX || '5'), // 5 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: (req: Request) => {
    return req.ip || 'unknown';
  },
});

const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'), // 1 minute
  max: parseInt(process.env.RATE_LIMIT_API_MAX || '100'),
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================================================
// DATABASE CONNECTION POOL
// ============================================================================
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: parseInt(process.env.DB_POOL_MAX || '100'),
  min: parseInt(process.env.DB_POOL_MIN || '10'),
  idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000'),
  connectionTimeoutMillis: 5000,
  application_name: 'auth-service',
});

pool.on('error', (err, client) => {
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message: 'Unexpected error on idle client',
      error: err.message,
    })
  );
});

// Test database connection
pool.query('SELECT NOW()')
  .then(() => {
    console.log('✅ Database connection successful');
  })
  .catch((err) => {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  });

// ============================================================================
// REDIS CONNECTION
// ============================================================================
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        console.error('❌ Redis max retries exceeded');
        return new Error('Max redis retries exceeded');
      }
      return Math.min(retries * 100, 3000);
    },
    keepAlive: 30000,
  },
  // Enable automatic reconnection after drop
  connectionName: 'auth-service-client',
});

redisClient.on('error', (err) => {
  console.warn(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'WARN',
      message: 'Redis connection error',
      error: err.message,
    })
  );
});

redisClient.on('connect', () => {
  console.log('✅ Redis connection successful');
});

(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    console.warn('⚠️  Redis connection deferred:', (err as Error).message);
  }
})();

// ============================================================================
// TYPES
// ============================================================================
declare global {
  namespace Express {
    interface Request {
      id: string;
      user?: {
        userId: string;
        email: string;
        role: string;
      };
    }
  }
}

interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  type: 'access' | 'refresh';
}

interface User {
  id: string;
  email: string;
  name: string;
  password: string;
  role: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================
function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required and must be a string' };
  }

  email = email.trim().toLowerCase();

  if (email.length > 255) {
    return { valid: false, error: 'Email exceeds maximum length of 255 characters' };
  }

  // RFC 5322 compliant email regex
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Email format is invalid' };
  }

  return { valid: true };
}

function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required and must be a string' };
  }

  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long' };
  }

  if (password.length > 128) {
    return { valid: false, error: 'Password exceeds maximum length of 128 characters' };
  }

  // Check for password strength: at least one uppercase, one lowercase, one number
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  if (!hasUpperCase || !hasLowerCase || !hasNumber) {
    return {
      valid: false,
      error: 'Password must contain uppercase, lowercase, and numeric characters',
    };
  }

  return { valid: true };
}

function validateName(name: string): { valid: boolean; error?: string } {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Name is required and must be a string' };
  }

  name = name.trim();

  if (name.length < 2) {
    return { valid: false, error: 'Name must be at least 2 characters long' };
  }

  if (name.length > 100) {
    return { valid: false, error: 'Name exceeds maximum length of 100 characters' };
  }

  // Allow only alphanumeric, spaces, hyphens, and apostrophes
  if (!/^[a-zA-Z\s\-']+$/.test(name)) {
    return { valid: false, error: 'Name contains invalid characters' };
  }

  return { valid: true };
}

// ============================================================================
// ERROR HANDLING
// ============================================================================
class AuthError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 400,
    public errorCode: string = 'UNKNOWN_ERROR'
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

const ERROR_CODES = {
  INVALID_EMAIL: 'INVALID_EMAIL',
  INVALID_PASSWORD: 'INVALID_PASSWORD',
  EMAIL_EXISTS: 'EMAIL_EXISTS',
  NOT_FOUND: 'USER_NOT_FOUND',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  DB_ERROR: 'DATABASE_ERROR',
  REDIS_ERROR: 'REDIS_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
};

// ============================================================================
// MIDDLEWARE
// ============================================================================
function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthError('Missing or invalid authorization header', 401, ERROR_CODES.INVALID_TOKEN);
    }

    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;

    if (decoded.type !== 'access') {
      throw new AuthError('Invalid token type', 401, ERROR_CODES.INVALID_TOKEN);
    }

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        error: 'Token expired',
        errorCode: ERROR_CODES.TOKEN_EXPIRED,
        requestId: req.id,
      });
    }

    if (err instanceof AuthError) {
      return res.status(err.statusCode).json({
        error: err.message,
        errorCode: err.errorCode,
        requestId: req.id,
      });
    }

    return res.status(401).json({
      error: 'Invalid token',
      errorCode: ERROR_CODES.INVALID_TOKEN,
      requestId: req.id,
    });
  }
}

// ============================================================================
// ROUTES - REGISTER
// ============================================================================
app.post('/api/v1/auth/register', authLimiter, async (req: Request, res: Response) => {
  const requestId = req.id;

  try {
    const { email: rawEmail, password: rawPassword, name: rawName } = req.body;

    // Validate email
    const emailValidation = validateEmail(rawEmail);
    if (!emailValidation.valid) {
      return res.status(400).json({
        error: emailValidation.error,
        errorCode: ERROR_CODES.INVALID_EMAIL,
        requestId,
      });
    }
    const email = rawEmail.trim().toLowerCase();

    // Validate password
    const passwordValidation = validatePassword(rawPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        error: passwordValidation.error,
        errorCode: ERROR_CODES.INVALID_PASSWORD,
        requestId,
      });
    }

    // Validate name
    const nameValidation = validateName(rawName);
    if (!nameValidation.valid) {
      return res.status(400).json({
        error: nameValidation.error,
        errorCode: 'INVALID_NAME',
        requestId,
      });
    }
    const name = rawName.trim();

    // Check if user already exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: 'Email already registered',
        errorCode: ERROR_CODES.EMAIL_EXISTS,
        requestId,
      });
    }

    // Hash password with bcrypt (rounds: 12 for production)
    const hashedPassword = await bcrypt.hash(rawPassword, 12);

    // Create user
    const result = await pool.query(
      `INSERT INTO users (email, password, name, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING id, email, name, role, created_at`,
      [email, hashedPassword, name, 'user']
    );

    const user = result.rows[0];

    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        requestId,
        action: 'USER_REGISTERED',
        userId: user.id,
        email: user.email,
      })
    );

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.created_at,
      },
      requestId,
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        requestId,
        action: 'REGISTER_ERROR',
        error: (error as Error).message,
      })
    );

    res.status(500).json({
      error: 'Registration failed',
      errorCode: ERROR_CODES.SERVER_ERROR,
      requestId,
    });
  }
});

// ============================================================================
// ROUTES - LOGIN
// ============================================================================
app.post('/api/v1/auth/login', authLimiter, async (req: Request, res: Response) => {
  const requestId = req.id;

  try {
    const { email: rawEmail, password } = req.body;

    // Validate email
    const emailValidation = validateEmail(rawEmail);
    if (!emailValidation.valid) {
      return res.status(400).json({
        error: emailValidation.error,
        errorCode: ERROR_CODES.INVALID_EMAIL,
        requestId,
      });
    }
    const email = rawEmail.trim().toLowerCase();

    if (!password || typeof password !== 'string') {
      return res.status(400).json({
        error: 'Password is required',
        errorCode: ERROR_CODES.INVALID_PASSWORD,
        requestId,
      });
    }

    // Fetch user from database
    const result = await pool.query(
      'SELECT id, email, name, password, role FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      // Don't reveal if user exists or not (security best practice)
      return res.status(401).json({
        error: 'Invalid email or password',
        errorCode: ERROR_CODES.INVALID_CREDENTIALS,
        requestId,
      });
    }

    const user: Partial<User> = result.rows[0];

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password!);

    if (!passwordMatch) {
      return res.status(401).json({
        error: 'Invalid email or password',
        errorCode: ERROR_CODES.INVALID_CREDENTIALS,
        requestId,
      });
    }

    // Generate access token (short-lived)
    const accessToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        type: 'access',
      } as TokenPayload,
      process.env.JWT_SECRET!,
      {
        expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m',
        issuer: 'auth-service',
        audience: 'api',
      }
    );

    // Generate refresh token (long-lived)
    const refreshToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        type: 'refresh',
      } as TokenPayload,
      process.env.JWT_REFRESH_SECRET!,
      {
        expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d',
        issuer: 'auth-service',
        audience: 'api',
      }
    );

    // Store refresh token in Redis with expiry
    try {
      await redisClient.setEx(
        `refresh_token:${user.id}`,
        7 * 24 * 60 * 60, // 7 days in seconds
        refreshToken
      );
    } catch (err) {
      console.warn('⚠️  Failed to cache refresh token in Redis:', (err as Error).message);
    }

    // Log successful login
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        requestId,
        action: 'USER_LOGIN',
        userId: user.id,
        email: user.email,
      })
    );

    res.status(200).json({
      message: 'Login successful',
      accessToken,
      refreshToken,
      expiresIn: parseInt(process.env.JWT_ACCESS_EXPIRY || '900'), // 15 minutes in seconds
      tokenType: 'Bearer',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      requestId,
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        requestId,
        action: 'LOGIN_ERROR',
        error: (error as Error).message,
      })
    );

    res.status(500).json({
      error: 'Login failed',
      errorCode: ERROR_CODES.SERVER_ERROR,
      requestId,
    });
  }
});

// ============================================================================
// ROUTES - REFRESH TOKEN
// ============================================================================
app.post('/api/v1/auth/refresh', apiLimiter, async (req: Request, res: Response) => {
  const requestId = req.id;

  try {
    const { refreshToken } = req.body;

    if (!refreshToken || typeof refreshToken !== 'string') {
      return res.status(400).json({
        error: 'Refresh token is required',
        errorCode: ERROR_CODES.INVALID_TOKEN,
        requestId,
      });
    }

    // Verify refresh token
    let decoded: TokenPayload;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as TokenPayload;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        return res.status(401).json({
          error: 'Refresh token expired',
          errorCode: ERROR_CODES.TOKEN_EXPIRED,
          requestId,
        });
      }
      throw new AuthError('Invalid refresh token', 401, ERROR_CODES.INVALID_TOKEN);
    }

    if (decoded.type !== 'refresh') {
      throw new AuthError('Invalid token type', 401, ERROR_CODES.INVALID_TOKEN);
    }

    // Verify token is cached in Redis
    try {
      const cachedToken = await redisClient.get(`refresh_token:${decoded.userId}`);
      if (cachedToken !== refreshToken) {
        return res.status(401).json({
          error: 'Refresh token has been revoked',
          errorCode: ERROR_CODES.INVALID_TOKEN,
          requestId,
        });
      }
    } catch (err) {
      console.warn('⚠️  Redis verification failed:', (err as Error).message);
      // Allow token verification via JWT signature alone if Redis is down
    }

    // Fetch user to confirm still exists and get latest role
    const result = await pool.query('SELECT id, email, role, name FROM users WHERE id = $1', [
      decoded.userId,
    ]);

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'User no longer exists',
        errorCode: ERROR_CODES.NOT_FOUND,
        requestId,
      });
    }

    const user = result.rows[0];

    // Generate new access token
    const accessToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        type: 'access',
      } as TokenPayload,
      process.env.JWT_SECRET!,
      {
        expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m',
        issuer: 'auth-service',
        audience: 'api',
      }
    );

    res.status(200).json({
      message: 'Token refreshed successfully',
      accessToken,
      expiresIn: parseInt(process.env.JWT_ACCESS_EXPIRY || '900'),
      tokenType: 'Bearer',
      requestId,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({
        error: error.message,
        errorCode: error.errorCode,
        requestId,
      });
    }

    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        requestId,
        action: 'REFRESH_TOKEN_ERROR',
        error: (error as Error).message,
      })
    );

    res.status(500).json({
      error: 'Token refresh failed',
      errorCode: ERROR_CODES.SERVER_ERROR,
      requestId,
    });
  }
});

// ============================================================================
// ROUTES - VERIFY TOKEN
// ============================================================================
app.post('/api/v1/auth/verify', apiLimiter, authMiddleware, (req: Request, res: Response) => {
  const requestId = req.id;

  res.status(200).json({
    message: 'Token is valid',
    valid: true,
    user: req.user,
    requestId,
  });
});

// ============================================================================
// ROUTES - LOGOUT
// ============================================================================
app.post('/api/v1/auth/logout', apiLimiter, authMiddleware, async (req: Request, res: Response) => {
  const requestId = req.id;

  try {
    // Revoke refresh token from Redis
    if (req.user) {
      try {
        await redisClient.del(`refresh_token:${req.user.userId}`);
      } catch (err) {
        console.warn('⚠️  Failed to revoke refresh token:', (err as Error).message);
      }
    }

    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        requestId,
        action: 'USER_LOGOUT',
        userId: req.user?.userId,
      })
    );

    res.status(200).json({
      message: 'Logout successful',
      requestId,
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        requestId,
        action: 'LOGOUT_ERROR',
        error: (error as Error).message,
      })
    );

    res.status(500).json({
      error: 'Logout failed',
      errorCode: ERROR_CODES.SERVER_ERROR,
      requestId,
    });
  }
});

// ============================================================================
// ROUTES - HEALTH CHECK
// ============================================================================
app.get('/health', apiLimiter, async (req: Request, res: Response) => {
  try {
    // Check database
    const dbCheck = await pool.query('SELECT NOW()');
    const dbHealthy = dbCheck.rows.length > 0;

    // Check Redis
    let redisHealthy = false;
    try {
      await redisClient.ping();
      redisHealthy = true;
    } catch {
      redisHealthy = false;
    }

    res.status(200).json({
      status: 'healthy',
      service: 'auth-service',
      timestamp: new Date().toISOString(),
      version: process.env.SERVICE_VERSION || '1.0.0',
      dependencies: {
        database: {
          status: dbHealthy ? 'healthy' : 'unhealthy',
        },
        redis: {
          status: redisHealthy ? 'healthy' : 'degraded',
        },
      },
      requestId: req.id,
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'auth-service',
      error: (error as Error).message,
      requestId: req.id,
    });
  }
});

// ============================================================================
// ROUTES - READY CHECK (for orchestrators)
// ============================================================================
app.get('/ready', apiLimiter, async (req: Request, res: Response) => {
  try {
    await pool.query('SELECT NOW()');

    res.status(200).json({
      status: 'ready',
      service: 'auth-service',
      requestId: req.id,
    });
  } catch {
    res.status(503).json({
      status: 'not_ready',
      service: 'auth-service',
      requestId: req.id,
    });
  }
});

// ============================================================================
// ERROR HANDLERS
// ============================================================================
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Route not found',
    errorCode: 'NOT_FOUND',
    path: req.path,
    requestId: req.id,
  });
});

app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      requestId: req.id,
      uncaughtError: err.message,
      stack: err.stack,
    })
  );

  res.status(500).json({
    error: 'Internal server error',
    errorCode: ERROR_CODES.SERVER_ERROR,
    requestId: req.id,
  });
});

// ============================================================================
// SERVER START
// ============================================================================
const server = app.listen(port, () => {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message: `✅ Auth Service started on port ${port}`,
      version: process.env.SERVICE_VERSION || '1.0.0',
      environment: 'production',
    })
  );
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received: starting graceful shutdown');
  server.close(async () => {
    await pool.end();
    if (redisClient.isOpen) {
      await redisClient.quit();
    }
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received: starting graceful shutdown');
  server.close(async () => {
    await pool.end();
    if (redisClient.isOpen) {
      await redisClient.quit();
    }
    process.exit(0);
  });
});

export default app;
