import express from 'express';
import { Kafka } from 'kafkajs';
import { WebSocket, WebSocketServer } from 'ws';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const port = process.env.PORT || 3009;
const server = require('http').createServer(app);
const wss = new WebSocketServer({ server });

const kafka = new Kafka({
  clientId: 'notification-service',
  brokers: [(process.env.KAFKA_BROKER || 'localhost:9092')],
});

const consumer = kafka.consumer({ groupId: 'notification-group' });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

function parseParamsFromURL(url: string): { token: string | null, isPaper: boolean } {
  try {
    const urlObj = new URL(url, 'http://localhost');
    return {
      token: urlObj.searchParams.get('token') || null,
      isPaper: urlObj.searchParams.get('isPaper') === 'true'
    };
  } catch {
    return { token: null, isPaper: false };
  }
}

// Subscribe to Kafka topics
async function startConsumer() {
  await consumer.connect();
  await consumer.subscribe({
    topics: ['trades', 'ai_signals', 'portfolio_updates', 'risk_alerts', 'price_updates', 'sentiment_updates'],
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      try {
        const data = JSON.parse(message.value?.toString() || '{}');
        const notification = {
          type: topic.toUpperCase(),
          data,
          timestamp: new Date(),
        };

        // Filter and Broadcast
        connectedClients.forEach((client, clientId) => {
          let shouldSend = false;

          // Price updates: broadcast to all (public data)
          if (topic === 'price_updates') {
            shouldSend = true;
          } 
          // Private data: only send if userId matches AND isPaper matches
          else if ((data.userId === client.userId || data.user_id === client.userId)) {
            // If the data has an isPaper flag, it MUST match the client's isPaper session
            if (data.isPaper !== undefined) {
               shouldSend = (data.isPaper === client.isPaper);
            } else if (data.is_paper !== undefined) {
               shouldSend = (data.is_paper === client.isPaper);
            } else {
               shouldSend = true; // Fallback for legacy messages
            }
          }
          // Signal data: broadcast to all (public signal)
          else if (topic === 'ai_signals' || topic === 'sentiment_updates') {
             shouldSend = true;
          }

          if (shouldSend && client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify(notification));
          }
        });
      } catch (err) {
        console.error('Error broadcasting notification:', err);
      }
    },
  });
}

interface ClientSession {
  ws: WebSocket;
  userId: string;
  isPaper: boolean;
}

const connectedClients = new Map<string, ClientSession>();

// WebSocket connections
wss.on('connection', (ws: WebSocket, req: any) => {
  const { token, isPaper } = parseParamsFromURL(req.url);
  if (!token) {
    ws.close(4001, 'No token provided');
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const userId = decoded.userId;
    const clientId = `${userId}-${isPaper ? 'paper-' : ''}${Date.now()}`;
    
    connectedClients.set(clientId, { ws, userId, isPaper });
    console.log(`📡 Client connected to Notifications: ${clientId} (Paper: ${isPaper})`);

    ws.on('close', () => {
      connectedClients.delete(clientId);
    });

    ws.on('error', (error) => {
      connectedClients.delete(clientId);
    });
    
    ws.send(JSON.stringify({ type: 'WELCOME', message: 'Real-time notifications active' }));
  } catch (err) {
    ws.close(4002, 'Invalid token');
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'notification-service', activeUsers: connectedClients.size });
});

server.listen(port, async () => {
  await startConsumer();
  console.log(`🚀 Notification Service (REAL-TIME & SECURE) on port ${port}`);
});
