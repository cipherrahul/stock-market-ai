import express, { Express, Request, Response, NextFunction } from 'express';
import axios, { AxiosInstance, AxiosError } from 'axios';
import dotenv from 'dotenv';

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import crypto from 'crypto';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cookieParser from 'cookie-parser';
import csurf from 'csurf';
import { Kafka } from 'kafkajs';
import jwt from 'jsonwebtoken';

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;

// Create HTTP server for WebSocket
const httpServer = http.createServer(app);

// WebSocket server
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

// Active WebSocket clients (set)
const activeClients = new Set<WebSocket>();

// CSRF protection
app.use(cookieParser());
app.use(csurf({ cookie: true }));

// ============================================================================
// ENVIRONMENT VALIDATION
// ============================================================================
const requiredEnvVars = [
  'AUTH_SERVICE_URL',
  'USER_SERVICE_URL',
  'MARKET_SERVICE_URL',
  'PORTFOLIO_SERVICE_URL',
  'TRADING_SERVICE_URL',
];

const missingEnvVars = requiredEnvVars.filter((varName) => !process.env[varName]);
if (missingEnvVars.length > 0) {
  console.warn(`⚠️  Missing service URLs: ${missingEnvVars.join(', ')}`);
  console.warn('ℹ️  Gateway will use service discovery or fallback URLs');
}

// ============================================================================
// SECURITY & MIDDLEWARE
// ============================================================================
app.use(helmet());
app.use(compression());
app.use(
  cors({
    origin: (process.env.CORS_ORIGIN || 'http://localhost:3002').split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID'],
    maxAge: 86400,
  })
);

app.use(express.json({ limit: process.env.BODY_LIMIT || '10mb' }));
app.use(express.urlencoded({ limit: process.env.BODY_LIMIT || '10mb', extended: true }));

// ============================================================================
// REQUEST CORRELATION ID
// ============================================================================
app.use((req: Request, res: Response, next: NextFunction) => {
  req.id = req.headers['x-request-id'] as string || crypto.randomUUID();
  res.setHeader('X-Request-ID', req.id);
  next();
});

// ============================================================================
// REQUEST LOGGING
// ============================================================================
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
        userAgent: req.headers['user-agent'],
      })
    );
  });
  next();
});

// ============================================================================
// WEBSOCKET REAL-TIME DATA
// ============================================================================

wss.on('connection', (socket: WebSocket) => {
  activeClients.add(socket);
  socket.send(JSON.stringify({ type: 'connection', message: 'Connected to gateway real-time feed' }));

  socket.on('pong', () => {
    // no-op keepalive
  });

  socket.on('message', (message) => {
    try {
      const payload = JSON.parse(message.toString());
      if (payload.type === 'ping') {
        socket.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
      }
    } catch {
      // ignore
    }
  });

  socket.on('close', () => {
    activeClients.delete(socket);
  });
});

function broadcastToClients(event: any) {
  const data = JSON.stringify(event);
  activeClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

const kafkaBrokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',').map((s) => s.trim());
const kafka = new Kafka({ clientId: 'api-gateway', brokers: kafkaBrokers });
const kafkaConsumer = kafka.consumer({ groupId: process.env.KAFKA_GROUP_ID || 'gateway-consumer-group' });

(async () => {
  try {
    await kafkaConsumer.connect();
    await kafkaConsumer.subscribe({ topic: process.env.KAFKA_MARKET_DATA_TOPIC || 'market-data', fromBeginning: false });

    await kafkaConsumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const payload = message.value ? message.value.toString() : null;
        if (!payload) return;

        const event = {
          type: 'kafka_event',
          topic,
          partition,
          payload: JSON.parse(payload),
          timestamp: new Date().toISOString(),
        };

        broadcastToClients(event);
      },
    });

    console.log('✅ Kafka consumer started for market-data topic');
  } catch (err) {
    console.error('❌ Kafka consumer startup failed', err);
  }
})();

// Basic WebSocket keepalive
setInterval(() => {
  activeClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.ping();
    }
  });
}, parseInt(process.env.WS_KEEPALIVE_MS || '30000', 10));

// ============================================================================
// CIRCUIT BREAKER
// ============================================================================
interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailureTime?: number;
  successCount: number;
}

const circuitBreakers: Record<string, CircuitBreakerState> = {};
const FAILURE_THRESHOLD = 5;
const RESET_TIMEOUT = 60000; // 1 minute
const SUCCESS_THRESHOLD = 2;

function getOrCreateCircuitBreaker(service: string): CircuitBreakerState {
  if (!circuitBreakers[service]) {
    circuitBreakers[service] = {
      state: 'closed',
      failureCount: 0,
      successCount: 0,
    };
  }
  return circuitBreakers[service];
}

function checkCircuitBreaker(service: string): boolean {
  const cb = getOrCreateCircuitBreaker(service);

  if (cb.state === 'closed') {
    return true;
  }

  if (cb.state === 'open') {
    if (Date.now() - (cb.lastFailureTime || 0) > RESET_TIMEOUT) {
      cb.state = 'half-open';
      cb.successCount = 0;
      return true;
    }
    return false;
  }

  // half-open state
  return true;
}

function recordSuccess(service: string) {
  const cb = getOrCreateCircuitBreaker(service);
  cb.failureCount = 0;

  if (cb.state === 'half-open') {
    cb.successCount++;
    if (cb.successCount >= SUCCESS_THRESHOLD) {
      cb.state = 'closed';
      cb.successCount = 0;
    }
  }
}

function recordFailure(service: string) {
  const cb = getOrCreateCircuitBreaker(service);
  cb.failureCount++;
  cb.lastFailureTime = Date.now();

  if (cb.failureCount >= FAILURE_THRESHOLD) {
    cb.state = 'open';
  }

  if (cb.state === 'half-open') {
    cb.state = 'open';
  }
}

// ============================================================================
// SERVICE DISCOVERY
// ============================================================================
const SERVICES = {
  auth: process.env.AUTH_SERVICE_URL || 'http://auth-service:3001',
  user: process.env.USER_SERVICE_URL || 'http://user-service:3002',
  market: process.env.MARKET_SERVICE_URL || 'http://market-data-service:3003',
  ai: process.env.AI_SERVICE_URL || 'http://ai-engine-service:3004',
  portfolio: process.env.PORTFOLIO_SERVICE_URL || 'http://portfolio-service:3005',
  trading: process.env.TRADING_SERVICE_URL || 'http://trading-engine-service:3006',
  broker: process.env.BROKER_SERVICE_URL || 'http://broker-integration-service:3007',
  backtest: process.env.BACKTEST_SERVICE_URL || 'http://backtesting-service:3008',
  notification: process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3009',
  risk: process.env.RISK_SERVICE_URL || 'http://risk-management-service:3010',
  sentiment: process.env.SENTIMENT_SERVICE_URL || 'http://sentiment-service:3011',
};

// ============================================================================
// AXIOS INSTANCE
// ============================================================================
const axiosInstance = axios.create({
  timeout: parseInt(process.env.SERVICE_TIMEOUT || '30000'),
  validateStatus: () => true, // Don't throw on any status code
});

// ============================================================================
// PROXY FUNCTION
// ============================================================================
async function proxyRequest(
  req: Request,
  res: Response,
  serviceName: string,
  targetUrl: string,
  method: string = 'GET',
  data?: any
) {
  const requestId = req.id;

  try {
    // Check circuit breaker
    if (!checkCircuitBreaker(serviceName)) {
      console.warn(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'WARN',
          requestId,
          action: 'CIRCUIT_BREAKER_OPEN',
          service: serviceName,
        })
      );
      return res.status(503).json({
        error: `Service ${serviceName} temporarily unavailable`,
        errorCode: 'SERVICE_UNAVAILABLE',
        requestId,
      });
    }

    // Forward request
    const config = {
      method: method.toLowerCase(),
      url: targetUrl,
      headers: {
        'X-Request-ID': requestId,
        ...(req.headers.authorization && { authorization: req.headers.authorization }),
      },
      ...(data && { data }),
    };

    const response = await axiosInstance(config);

    // Record success
    if (response.status < 500) {
      recordSuccess(serviceName);
    }

    // Forward response headers
    Object.entries(response.headers).forEach(([key, value]) => {
      if (key.toLowerCase() !== 'content-encoding') {
        res.setHeader(key, value);
      }
    });

    res.status(response.status).json(response.data);
  } catch (error) {
    recordFailure(serviceName);

    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        requestId,
        action: 'PROXY_ERROR',
        service: serviceName,
        targetUrl,
        error: (error as Error).message,
      })
    );

    res.status(503).json({
      error: `Failed to reach ${serviceName}`,
      errorCode: 'GATEWAY_ERROR',
      requestId,
    });
  }
}

// ============================================================================
// RATE LIMITING
// ============================================================================
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

function getUserIdFromRequest(req: Request): string {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return req.ip || 'unknown';
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { userId?: string };
    return decoded.userId || req.ip || 'anonymous';
  } catch {
    return req.ip || 'anonymous';
  }
}

const perUserLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 75,
  keyGenerator: getUserIdFromRequest,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(perUserLimiter);

// Auth routes
app.post('/api/v1/auth/register', authLimiter, (req: Request, res: Response) => {
  proxyRequest(req, res, 'auth', `${SERVICES.auth}/api/v1/auth/register`, 'POST', req.body);
});

app.post('/api/v1/auth/login', authLimiter, (req: Request, res: Response) => {
  proxyRequest(req, res, 'auth', `${SERVICES.auth}/api/v1/auth/login`, 'POST', req.body);
});

app.post('/api/v1/auth/refresh', apiLimiter, (req: Request, res: Response) => {
  proxyRequest(req, res, 'auth', `${SERVICES.auth}/api/v1/auth/refresh`, 'POST', req.body);
});

app.post('/api/v1/auth/verify', apiLimiter, (req: Request, res: Response) => {
  proxyRequest(req, res, 'auth', `${SERVICES.auth}/api/v1/auth/verify`, 'POST', req.body);
});

app.post('/api/v1/auth/logout', apiLimiter, (req: Request, res: Response) => {
  proxyRequest(req, res, 'auth', `${SERVICES.auth}/api/v1/auth/logout`, 'POST', req.body);
});

app.get('/api/v1/auth/csrf-token', (req: Request & { csrfToken?: () => string }, res: Response) => {
  const token = req.csrfToken && req.csrfToken();
  if (!token) {
    return res.status(500).json({ error: 'Could not generate CSRF token' });
  }

  res.cookie('XSRF-TOKEN', token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });

  res.json({ csrfToken: token });
});

// Market data routes
app.get('/api/v1/market/stocks/:symbol', apiLimiter, (req: Request, res: Response) => {
  proxyRequest(
    req,
    res,
    'market',
    `${SERVICES.market}/api/v1/market/stocks/${req.params.symbol}?${new URLSearchParams(
      req.query as any
    ).toString()}`,
    'GET'
  );
});

app.get('/api/v1/market/quote/:symbol', apiLimiter, (req: Request, res: Response) => {
  proxyRequest(
    req,
    res,
    'market',
    `${SERVICES.market}/api/v1/market/quote/${req.params.symbol}`,
    'GET'
  );
});

app.get('/api/v1/market/history/:symbol', apiLimiter, (req: Request, res: Response) => {
  proxyRequest(
    req,
    res,
    'market',
    `${SERVICES.market}/api/v1/market/history/${req.params.symbol}?${new URLSearchParams(
      req.query as any
    ).toString()}`,
    'GET'
  );
});

// Portfolio routes
app.get('/api/v1/portfolio/:userId', apiLimiter, (req: Request, res: Response) => {
  proxyRequest(req, res, 'portfolio', `${SERVICES.portfolio}/api/v1/portfolio/${req.params.userId}`, 'GET');
});

app.get('/api/v1/portfolio/:userId/performance', apiLimiter, (req: Request, res: Response) => {
  proxyRequest(
    req,
    res,
    'portfolio',
    `${SERVICES.portfolio}/api/v1/portfolio/${req.params.userId}/performance`,
    'GET'
  );
});

// Trading routes
app.post('/api/v1/trading/execute', apiLimiter, (req: Request, res: Response) => {
  proxyRequest(req, res, 'trading', `${SERVICES.trading}/api/v1/trading/execute`, 'POST', req.body);
});

app.get('/api/v1/trading/orders/:userId', apiLimiter, (req: Request, res: Response) => {
  proxyRequest(
    req,
    res,
    'trading',
    `${SERVICES.trading}/api/v1/trading/orders/${req.params.userId}`,
    'GET'
  );
});

app.get('/api/v1/trading/orders/:orderId/status', apiLimiter, (req: Request, res: Response) => {
  proxyRequest(
    req,
    res,
    'trading',
    `${SERVICES.trading}/api/v1/trading/orders/${req.params.orderId}/status`,
    'GET'
  );
});

// User routes
app.get('/api/v1/users/:userId', apiLimiter, (req: Request, res: Response) => {
  proxyRequest(req, res, 'user', `${SERVICES.user}/api/v1/users/${req.params.userId}`, 'GET');
});

app.put('/api/v1/users/:userId', apiLimiter, (req: Request, res: Response) => {
  proxyRequest(req, res, 'user', `${SERVICES.user}/api/v1/users/${req.params.userId}`, 'PUT', req.body);
});

// AI/Sentiment routes
app.get('/api/v1/ai/sentiment/:symbol', apiLimiter, (req: Request, res: Response) => {
  proxyRequest(
    req,
    res,
    'sentiment',
    `${SERVICES.sentiment}/api/v1/ai/sentiment/${req.params.symbol}`,
    'GET'
  );
});

app.post('/api/v1/ai/analyze', apiLimiter, (req: Request, res: Response) => {
  proxyRequest(req, res, 'ai', `${SERVICES.ai}/api/v1/ai/analyze`, 'POST', req.body);
});

// Risk management routes
app.get('/api/v1/risk/assessment/:userId', apiLimiter, (req: Request, res: Response) => {
  proxyRequest(
    req,
    res,
    'risk',
    `${SERVICES.risk}/api/v1/risk/assessment/${req.params.userId}`,
    'GET'
  );
});

app.post('/api/v1/risk/validate', apiLimiter, (req: Request, res: Response) => {
  proxyRequest(req, res, 'risk', `${SERVICES.risk}/api/v1/risk/validate`, 'POST', req.body);
});

// Notification routes
app.post('/api/v1/notifications/subscribe', apiLimiter, (req: Request, res: Response) => {
  proxyRequest(req, res, 'notification', `${SERVICES.notification}/api/v1/notifications/subscribe`, 'POST', req.body);
});

app.get('/api/v1/notifications/:userId', apiLimiter, (req: Request, res: Response) => {
  proxyRequest(
    req,
    res,
    'notification',
    `${SERVICES.notification}/api/v1/notifications/${req.params.userId}`,
    'GET'
  );
});

// Backtesting routes
app.post('/api/v1/backtest/run', apiLimiter, (req: Request, res: Response) => {
  proxyRequest(req, res, 'backtest', `${SERVICES.backtest}/api/v1/backtest/run`, 'POST', req.body);
});

app.get('/api/v1/backtest/results/:testId', apiLimiter, (req: Request, res: Response) => {
  proxyRequest(
    req,
    res,
    'backtest',
    `${SERVICES.backtest}/api/v1/backtest/results/${req.params.testId}`,
    'GET'
  );
});

// ============================================================================
// SERVICE HEALTH ENDPOINTS
// ============================================================================
app.get('/health', async (req: Request, res: Response) => {
  try {
    const serviceHealth: Record<string, any> = {};
    const requestId = req.id;

    for (const [serviceName, url] of Object.entries(SERVICES)) {
      try {
        const response = await axios.get(`${url}/health`, { timeout: 5000 });
        serviceHealth[serviceName] = {
          status: response.status === 200 ? 'healthy' : 'unhealthy',
          circuitBreaker: getOrCreateCircuitBreaker(serviceName).state,
        };
      } catch {
        serviceHealth[serviceName] = {
          status: 'unavailable',
          circuitBreaker: getOrCreateCircuitBreaker(serviceName).state,
        };
      }
    }

    res.status(200).json({
      status: 'healthy',
      service: 'api-gateway',
      timestamp: new Date().toISOString(),
      version: process.env.SERVICE_VERSION || '1.0.0',
      dependencies: serviceHealth,
      requestId,
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'api-gateway',
      error: (error as Error).message,
      requestId: req.id,
    });
  }
});

app.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check critical services
    const services = [SERVICES.auth, SERVICES.market, SERVICES.trading];
    const allReady = await Promise.all(
      services.map(async (url) => {
        try {
          const response = await axios.get(`${url}/ready`, { timeout: 5000 });
          return response.status === 200;
        } catch {
          return false;
        }
      })
    );

    if (allReady.every((r) => r)) {
      res.status(200).json({
        status: 'ready',
        service: 'api-gateway',
        requestId: req.id,
      });
    } else {
      res.status(503).json({
        status: 'not_ready',
        service: 'api-gateway',
        requestId: req.id,
      });
    }
  } catch {
    res.status(503).json({
      status: 'not_ready',
      service: 'api-gateway',
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
    path: req.method + ' ' + req.path,
    requestId: req.id,
  });
});

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
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
    error: 'Internal gateway error',
    errorCode: 'GATEWAY_ERROR',
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
      message: `✅ API Gateway started on port ${port}`,
      version: process.env.SERVICE_VERSION || '1.0.0',
      environment: 'production',
      services: SERVICES,
    })
  );
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received: starting graceful shutdown');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received: starting graceful shutdown');
  server.close(() => {
    process.exit(0);
  });
});

export default app;
