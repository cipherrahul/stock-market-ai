import express from 'express';
import { Kafka } from 'kafkajs';
import { Pool } from 'pg';
import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3003;

app.use(express.json());

const kafka = new Kafka({
  clientId: 'market-data-service',
  brokers: [(process.env.KAFKA_BROKER || 'localhost:9092')],
});

const producer = kafka.producer();
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const redisClient = createClient({ url: process.env.REDIS_URL });

// Get real-time market data
app.get('/api/v1/market/stocks/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const cached = await redisClient.get(`market:${symbol}`);

    if (cached) {
      return res.json(JSON.parse(cached));
    }

    // Simulated market data (replace with real API)
    const marketData = {
      symbol,
      price: Math.random() * 1000,
      change: (Math.random() - 0.5) * 10,
      volume: Math.floor(Math.random() * 1000000),
      timestamp: new Date(),
    };

    await redisClient.setEx(`market:${symbol}`, 60, JSON.stringify(marketData));
    res.json(marketData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch market data' });
  }
});

// Historical data
app.get('/api/v1/market/history/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { days = 30 } = req.query;

    const result = await pool.query(
      'SELECT * FROM market_history WHERE symbol = $1 ORDER BY date DESC LIMIT $2',
      [symbol, days]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'market-data-service' });
});

app.listen(port, async () => {
  await producer.connect();
  await redisClient.connect();
  console.log(`Market Data Service on port ${port}`);
});
