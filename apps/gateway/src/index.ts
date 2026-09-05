import express, { Express, Request, Response, NextFunction } from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import crypto from 'crypto';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cookieParser from 'cookie-parser';
import csurf from 'csurf';
import { createClient } from 'redis';
import jwt from 'jsonwebtoken';
import { rateLimit } from 'express-rate-limit';

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;

// Create HTTP server for WebSocket
const httpServer = http.createServer(app);

// WebSocket server
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

// Active WebSocket clients (set)
const activeClients = new Set<WebSocket>();

// Cookie support for browser-facing routes
app.use(cookieParser());
const csrfProtection = csurf({ cookie: true });

// ============================================================================
// SECURITY & MIDDLEWARE
// ============================================================================
app.use(helmet());
app.use(compression());
app.use(
  cors({
    origin: (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:5000').split(','),
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
// REQUEST CORRELATION ID & LOGGING
// ============================================================================
app.use((req: Request, res: Response, next: NextFunction) => {
  req.id = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  res.setHeader('X-Request-ID', req.id);

  const startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    if (res.statusCode >= 400) {
      console.warn(`[${req.method}] ${req.path} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// ============================================================================
// WEBSOCKET REAL-TIME DATA STREAM (REDIS PUB/SUB)
// ============================================================================

wss.on('connection', (socket: WebSocket) => {
  activeClients.add(socket);
  socket.send(JSON.stringify({ type: 'connection', message: 'Connected to gateway real-time feed' }));

  socket.on('message', (message) => {
    try {
      const payload = JSON.parse(message.toString());
      if (payload.type === 'ping') {
        socket.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
      }
    } catch {
      // ignore invalid json
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

// Redis Pub/Sub subscriber for live market ticks and multi-agent thoughts
const redisSub = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });

(async () => {
  try {
    await redisSub.connect();
    console.log('✅ Gateway Redis subscriber connected for real-time WebSocket feeds');

    // Subscribe to real-time streams
    await redisSub.subscribe(
      ['market_ticks', 'agent:thoughts', 'trading:signals', 'trading:orders'],
      (message: string, channel: string) => {
        try {
          const parsed = JSON.parse(message);
          broadcastToClients({
            type: channel,
            data: parsed,
            timestamp: new Date().toISOString(),
          });
        } catch {
          broadcastToClients({
            type: channel,
            data: message,
            timestamp: new Date().toISOString(),
          });
        }
      }
    );
  } catch (err: any) {
    console.warn('⚠️ Gateway Redis subscription deferred:', err.message);
  }
})();

// Basic WebSocket keepalive
const keepAliveTimer = setInterval(() => {
  activeClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.ping();
    }
  });
}, 30000);

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
const RESET_TIMEOUT = 60000;
const SUCCESS_THRESHOLD = 2;

function checkCircuitBreaker(service: string): boolean {
  if (!circuitBreakers[service]) {
    circuitBreakers[service] = { state: 'closed', failureCount: 0, successCount: 0 };
  }
  const cb = circuitBreakers[service];

  if (cb.state === 'closed') return true;
  if (cb.state === 'open') {
    if (Date.now() - (cb.lastFailureTime || 0) > RESET_TIMEOUT) {
      cb.state = 'half-open';
      cb.successCount = 0;
      return true;
    }
    return false;
  }
  return true;
}

function recordSuccess(service: string) {
  const cb = circuitBreakers[service];
  if (!cb) return;
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
  if (!circuitBreakers[service]) {
    circuitBreakers[service] = { state: 'closed', failureCount: 0, successCount: 0 };
  }
  const cb = circuitBreakers[service];
  cb.failureCount++;
  cb.lastFailureTime = Date.now();
  if (cb.failureCount >= FAILURE_THRESHOLD) {
    cb.state = 'open';
  }
}

// ============================================================================
// SERVICE DISCOVERY
// ============================================================================
const SERVICES = {
  auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
  user: process.env.USER_SERVICE_URL || 'http://localhost:3002',
  market: process.env.MARKET_SERVICE_URL || 'http://localhost:3003',
  ai: process.env.AI_SERVICE_URL || 'http://localhost:3004',
  portfolio: process.env.PORTFOLIO_SERVICE_URL || 'http://localhost:3005',
  trading: process.env.TRADING_SERVICE_URL || 'http://localhost:3006',
  broker: process.env.BROKER_SERVICE_URL || 'http://localhost:3007',
  backtest: process.env.BACKTEST_SERVICE_URL || 'http://localhost:3008',
  notification: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3009',
  risk: process.env.RISK_SERVICE_URL || 'http://localhost:3010',
};

const axiosInstance = axios.create({
  timeout: parseInt(process.env.SERVICE_TIMEOUT || '15000'),
  validateStatus: () => true,
});

async function proxyRequest(
  req: Request,
  res: Response,
  serviceName: string,
  targetUrl: string,
  method: string = 'GET',
  data?: any
) {
  if (!checkCircuitBreaker(serviceName)) {
    return res.status(503).json({
      error: `Service ${serviceName} temporarily unavailable (circuit open)`,
      errorCode: 'SERVICE_UNAVAILABLE',
    });
  }

  try {
    const headers: Record<string, string> = {
      'x-request-id': req.id || '',
    };
    if (req.headers.authorization) {
      headers['authorization'] = req.headers.authorization;
    }
    if (req.headers['content-type']) {
      headers['content-type'] = req.headers['content-type'] as string;
    }

    const response = await axiosInstance({
      method: method.toLowerCase() as any,
      url: targetUrl,
      headers,
      data,
    });

    recordSuccess(serviceName);
    return res.status(response.status).json(response.data);
  } catch (error: any) {
    recordFailure(serviceName);
    return res.status(502).json({
      error: `Failed to communicate with ${serviceName}`,
      detail: error.message,
    });
  }
}

// Rate Limiter
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(apiLimiter);

// ============================================================================
// PROXY ROUTES
// ============================================================================

// Multi-Agent Engine (State of the Art)
app.post('/api/v1/agents/analyze', (req: Request, res: Response) => {
  proxyRequest(req, res, 'ai', `${SERVICES.ai}/api/v1/agents/analyze`, 'POST', req.body);
});

app.get('/api/v1/agents/indicators/:symbol', (req: Request, res: Response) => {
  proxyRequest(req, res, 'ai', `${SERVICES.ai}/api/v1/agents/indicators/${req.params.symbol}`, 'GET');
});

app.get('/api/v1/agents/quote/:symbol', (req: Request, res: Response) => {
  proxyRequest(req, res, 'ai', `${SERVICES.ai}/api/v1/agents/quote/${req.params.symbol}`, 'GET');
});

// Legacy AI compatibility routes
app.get('/api/v1/ai/predict/:symbol', (req: Request, res: Response) => {
  proxyRequest(req, res, 'ai', `${SERVICES.ai}/api/v1/ai/predict/${req.params.symbol}`, 'GET');
});

app.post('/api/v1/ai/generate-signal', (req: Request, res: Response) => {
  proxyRequest(req, res, 'ai', `${SERVICES.ai}/api/v1/ai/generate-signal`, 'POST', req.body);
});

// Market Data routes
app.get('/api/v1/market/quote/:symbol', (req: Request, res: Response) => {
  proxyRequest(req, res, 'market', `${SERVICES.market}/api/v1/market/quote/${req.params.symbol}`, 'GET');
});

app.get('/api/v1/market/history/:symbol', (req: Request, res: Response) => {
  proxyRequest(req, res, 'market', `${SERVICES.market}/api/v1/market/history/${req.params.symbol}?${new URLSearchParams(req.query as any).toString()}`, 'GET');
});

// Portfolio routes
app.get('/api/v1/portfolio/:userId', (req: Request, res: Response) => {
  proxyRequest(req, res, 'portfolio', `${SERVICES.portfolio}/api/v1/portfolio/${req.params.userId}`, 'GET');
});

app.get('/api/v1/portfolio/:userId/performance', (req: Request, res: Response) => {
  proxyRequest(req, res, 'portfolio', `${SERVICES.portfolio}/api/v1/portfolio/${req.params.userId}/performance`, 'GET');
});

// Trading Execution routes
app.post('/api/v1/trading/execute', (req: Request, res: Response) => {
  proxyRequest(req, res, 'trading', `${SERVICES.trading}/api/v1/trading/execute`, 'POST', req.body);
});

app.post('/api/v1/trading/square-off', (req: Request, res: Response) => {
  proxyRequest(req, res, 'trading', `${SERVICES.trading}/api/v1/trading/square-off`, 'POST', req.body);
});

app.get('/api/v1/trading/intraday/positions/:userId', (req: Request, res: Response) => {
  proxyRequest(req, res, 'trading', `${SERVICES.trading}/api/v1/trading/intraday/positions/${req.params.userId}`, 'GET');
});

app.get('/api/v1/trading/orders/:userId', (req: Request, res: Response) => {
  proxyRequest(req, res, 'trading', `${SERVICES.trading}/api/v1/trading/orders/${req.params.userId}`, 'GET');
});

// AI & Intraday Quantitative Indicators routes
app.get('/api/v1/agents/indicators/:symbol', (req: Request, res: Response) => {
  const interval = req.query.interval || '5m';
  proxyRequest(req, res, 'ai', `${SERVICES.ai}/api/v1/agents/indicators/${req.params.symbol}?interval=${interval}`, 'GET');
});

app.post('/api/v1/agents/analyze', (req: Request, res: Response) => {
  proxyRequest(req, res, 'ai', `${SERVICES.ai}/api/v1/agents/analyze`, 'POST', req.body);
});

// Auth routes
app.post('/api/v1/auth/register', (req: Request, res: Response) => {
  proxyRequest(req, res, 'auth', `${SERVICES.auth}/api/v1/auth/register`, 'POST', req.body);
});

app.post('/api/v1/auth/login', (req: Request, res: Response) => {
  proxyRequest(req, res, 'auth', `${SERVICES.auth}/api/v1/auth/login`, 'POST', req.body);
});

// User routes
app.get('/api/v1/users/:userId', (req: Request, res: Response) => {
  proxyRequest(req, res, 'user', `${SERVICES.user}/api/v1/users/${req.params.userId}`, 'GET');
});

// ============================================================================
// HEALTH & READY
// ============================================================================
app.get('/health', async (req: Request, res: Response) => {
  res.json({
    status: 'HEALTHY',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    architecture: 'Multi-Agent Gateway + WebSocket Pub/Sub',
    active_ws_connections: activeClients.size,
  });
});

app.get('/ready', async (req: Request, res: Response) => {
  res.json({ status: 'READY', service: 'api-gateway' });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found', path: req.path });
});

// Server start
const server = httpServer.listen(port, () => {
  console.log(`🚀 API Gateway active on http://localhost:${port}`);
  console.log(`📡 WebSocket Feed listening on ws://localhost:${port}/ws`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  clearInterval(keepAliveTimer);
  activeClients.forEach((c) => c.close());
  await redisSub.disconnect().catch(() => undefined);
  wss.close();
  server.close();
});

process.on('SIGINT', async () => {
  clearInterval(keepAliveTimer);
  activeClients.forEach((c) => c.close());
  await redisSub.disconnect().catch(() => undefined);
  wss.close();
  server.close();
});

export default app;
