import express, { Express, Request, Response, NextFunction } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import axios, { AxiosInstance } from 'axios';
import { Kafka } from 'kafkajs';
import dotenv from 'dotenv';
import cors from 'cors';
import jwt from 'jsonwebtoken';

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;

// Create HTTP server for WebSocket support
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Kafka for receiving real-time updates
const kafka = new Kafka({
  clientId: 'api-gateway-realtime',
  brokers: [(process.env.KAFKA_BROKER || 'localhost:9092')],
});

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

/**
 * RATE LIMITING MIDDLEWARE
 */
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

/**
 * JWT VERIFICATION MIDDLEWARE
 */
const verifyToken = (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    (req as any).userId = (decoded as any).userId;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

/**
 * WEBSOCKET MANAGEMENT
 */
interface ConnectedClient {
  ws: WebSocket;
  userId: string;
  subscriptions: Set<string>;
}

const connectedClients = new Map<string, ConnectedClient>();

// Parse JWT from WebSocket URL query param
function parseJWTFromURL(url: string): string | null {
  try {
    const urlObj = new URL(url, 'http://localhost');
    return urlObj.searchParams.get('token') || null;
  } catch {
    return null;
  }
}

// Handle WebSocket connections
wss.on('connection', (ws: WebSocket, req: any) => {
  try {
    const token = parseJWTFromURL(req.url);

    if (!token) {
      ws.close(4001, 'No token provided');
      return;
    }

    let userId: string;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
      userId = decoded.userId;
    } catch {
      ws.close(4002, 'Invalid token');
      return;
    }

    const clientId = `${userId}-${Date.now()}`;
    connectedClients.set(clientId, {
      ws,
      userId,
      subscriptions: new Set(),
    });

    console.log(`✅ Client connected: ${clientId}`);

    // Send welcome message
    ws.send(
      JSON.stringify({
        type: 'CONNECTED',
        message: `Connected to real-time market data`,
        clientId,
        timestamp: new Date(),
      })
    );

    // Handle incoming messages
    ws.on('message', (data: string) => {
      try {
        const message = JSON.parse(data);
        const client = connectedClients.get(clientId);

        if (!client) return;

        if (message.type === 'SUBSCRIBE') {
          // Subscribe to symbol updates
          const { channel } = message;
          client.subscriptions.add(channel);
          ws.send(
            JSON.stringify({
              type: 'SUBSCRIBED',
              channel,
              timestamp: new Date(),
            })
          );
          console.log(`📍 Client ${clientId} subscribed to ${channel}`);
        } else if (message.type === 'UNSUBSCRIBE') {
          // Unsubscribe from symbol updates
          const { channel } = message;
          client.subscriptions.delete(channel);
          ws.send(
            JSON.stringify({
              type: 'UNSUBSCRIBED',
              channel,
              timestamp: new Date(),
            })
          );
        } else if (message.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: new Date() }));
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    });

    // Handle disconnection
    ws.on('close', () => {
      connectedClients.delete(clientId);
      console.log(`❌ Client disconnected: ${clientId}`);
    });

    ws.on('error', (error) => {
      console.error(`❌ WebSocket error for ${clientId}:`, error.message);
      connectedClients.delete(clientId);
    });
  } catch (error) {
    console.error('Connection error:', error);
    ws.close(4000, 'Internal server error');
  }
});

/**
 * KAFKA CONSUMER FOR REAL-TIME UPDATES
 */
async function startRealtimeConsumer() {
  const consumer = kafka.consumer({ groupId: 'api-gateway-realtime' });

  try {
    await consumer.connect();
    await consumer.subscribe({
      topics: ['price_updates', 'trades', 'ai_signals', 'portfolio_updates', 'risk_alerts'],
      fromBeginning: false,
    });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const data = JSON.parse(message.value?.toString() || '{}');

          // Broadcast to all connected clients
          connectedClients.forEach((client, clientId) => {
            // Only send if client is subscribed to this type
            let shouldSend = false;

            if (topic === 'price_updates' && client.subscriptions.has(`price:${data.symbol}`)) {
              shouldSend = true;
            } else if (
              ['trades', 'ai_signals', 'portfolio_updates', 'risk_alerts'].includes(topic) &&
              client.subscriptions.has(topic)
            ) {
              shouldSend = true;
            } else if (client.subscriptions.has('*')) {
              // Subscribe to all
              shouldSend = true;
            }

            if (shouldSend && client.ws.readyState === WebSocket.OPEN) {
              client.ws.send(
                JSON.stringify({
                  type: topic.toUpperCase(),
                  data,
                  timestamp: new Date(),
                })
              );
            }
          });
        } catch (error) {
          console.error('Error processing message:', error);
        }
      },
    });
  } catch (error) {
    console.error('Consumer error:', error);
  }
}

/**
 * HTTP REST ENDPOINTS
 */

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

// Market routes - REALTIME ENABLED
app.get('/api/v1/market/stocks/:symbol', limiter(30), async (req: Request, res: Response) => {
  try {
    const response = await axios.get(
      `${SERVICES.market}/api/v1/market/stocks/${req.params.symbol}`
    );
    res.json({ ...response.data, realtime: true, wsPath: 'ws://localhost:3000/ws' });
  } catch (error: any) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: 'Failed' });
  }
});

app.get('/api/v1/market/stocks', limiter(10), async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${SERVICES.market}/api/v1/market/stocks`);
    res.json({
      data: response.data,
      realtime: true,
      wsPath: 'ws://localhost:3000/ws',
      subscribeChannels: response.data.map((stock: any) => `price:${stock.symbol}`),
    });
  } catch (error: any) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: 'Failed' });
  }
});

// Portfolio routes - REALTIME ENABLED
app.get('/api/v1/portfolio/:userId', verifyToken, async (req: Request, res: Response) => {
  try {
    const response = await axios.get(
      `${SERVICES.portfolio}/api/v1/portfolio/${req.params.userId}`,
      {
        headers: { Authorization: req.headers.authorization },
      }
    );
    res.json({
      ...response.data,
      realtime: true,
      subscribeChannels: ['portfolio_updates', 'trades'],
    });
  } catch (error: any) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: 'Failed' });
  }
});

// Trading routes
app.post('/api/v1/trading/execute', limiter(15), verifyToken, async (req: Request, res: Response) => {
  try {
    const response = await axios.post(`${SERVICES.trading}/api/v1/trading/execute`, req.body, {
      headers: { Authorization: req.headers.authorization },
    });
    res.status(201).json({
      ...response.data,
      realtime: true,
      subscribeChannels: ['trades', 'portfolio_updates'],
    });
  } catch (error: any) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: 'Failed' });
  }
});

// AI signals routes - REALTIME ENABLED
app.get('/api/v1/ai/predict/:symbol', limiter(20), async (req: Request, res: Response) => {
  try {
    const response = await axios.get(
      `${SERVICES.ai}/api/v1/ai/predict/${req.params.symbol}`
    );
    res.json({
      ...response.data,
      realtime: true,
      subscribeChannels: ['ai_signals'],
    });
  } catch (error: any) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: 'Failed' });
  }
});

app.post('/api/v1/ai/train/:symbol', limiter(5), async (req: Request, res: Response) => {
  try {
    const response = await axios.post(`${SERVICES.ai}/api/v1/ai/train/${req.params.symbol}`);
    res.json(response.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: 'Training failed' });
  }
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'OK',
    service: 'api-gateway',
    realtime: true,
    wsSupport: true,
    connectedClients: connectedClients.size,
    wsPath: 'ws://localhost:3000/ws',
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
async function start() {
  try {
    // Start Kafka consumer for real-time updates
    startRealtimeConsumer();

    server.listen(port, () => {
      console.log(`🚀 API Gateway (REALTIME) listening on port ${port}`);
      console.log(`📡 WebSocket: ws://localhost:${port}/ws`);
      console.log(`🔄 Real-time channels: price_updates, trades, ai_signals, portfolio_updates, risk_alerts`);
      console.log(`✅ 100% REAL-TIME SYSTEM ACTIVE`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
