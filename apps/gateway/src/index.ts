import express, { Express, Request, Response, NextFunction } from 'express';
import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Service URLs
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
};

// Rate limiting middleware
const limiter = (limit: number) => {
  const requests: Record<string, number[]> = {};

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    const windowMs = 60000; // 1 minute

    if (!requests[key]) {
      requests[key] = [];
    }

    requests[key] = requests[key].filter((time) => now - time < windowMs);

    if (requests[key].length >= limit) {
      return res.status(429).json({ error: 'Too many requests' });
    }

    requests[key].push(now);
    next();
  };
};

// Auth routes
app.post('/api/v1/auth/register', limiter(5), async (req: Request, res: Response) => {
  try {
    const response = await axios.post(`${SERVICES.auth}/api/v1/auth/register`, req.body);
    res.json(response.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: 'Failed' });
  }
});

app.post('/api/v1/auth/login', limiter(5), async (req: Request, res: Response) => {
  try {
    const response = await axios.post(`${SERVICES.auth}/api/v1/auth/login`, req.body);
    res.json(response.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: 'Failed' });
  }
});

// Market routes
app.get('/api/v1/market/stocks/:symbol', limiter(30), async (req: Request, res: Response) => {
  try {
    const response = await axios.get(
      `${SERVICES.market}/api/v1/market/stocks/${req.params.symbol}`
    );
    res.json(response.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: 'Failed' });
  }
});

// Portfolio routes
app.get('/api/v1/portfolio/:userId', async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${SERVICES.portfolio}/api/v1/portfolio/${req.params.userId}`,
      {
        headers: { Authorization: req.headers.authorization },
      }
    );
    res.json(response.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: 'Failed' });
  }
});

// Trading routes
app.post('/api/v1/trading/execute', limiter(15), async (req: Request, res: Response) => {
  try {
    const response = await axios.post(`${SERVICES.trading}/api/v1/trading/execute`, req.body, {
      headers: { Authorization: req.headers.authorization },
    });
    res.status(201).json(response.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: 'Failed' });
  }
});

// User routes
app.get('/api/v1/users/:userId', async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${SERVICES.user}/api/v1/users/${req.params.userId}`, {
      headers: { Authorization: req.headers.authorization },
    });
    res.json(response.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: 'Failed' });
  }
});

app.put('/api/v1/users/:userId', async (req: Request, res: Response) => {
  try {
    const response = await axios.put(`${SERVICES.user}/api/v1/users/${req.params.userId}`, req.body, {
      headers: { Authorization: req.headers.authorization },
    });
    res.json(response.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: 'Failed' });
  }
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', service: 'api-gateway' });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  console.log(`🚀 API Gateway listening on port ${port}`);
});
