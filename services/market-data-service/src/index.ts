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
    const days = parseInt(req.query.days as string) || 30;

    if (days < 1 || days > 365) {
      return res.status(400).json({ error: 'Days must be between 1 and 365' });
    }

    const result = await pool.query(
      'SELECT * FROM market_history WHERE symbol = $1 ORDER BY time DESC LIMIT $2',
      [symbol, days]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Market history error:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'market-data-service' });
});

const TRACKED_SYMBOLS = [
  'RELIANCE', 'TCS', 'INFY', 'WIPRO', 'HDFCBANK', // India
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META' // Global
];

async function startPriceBroadcast() {
  setInterval(async () => {
    try {
      const symbol = TRACKED_SYMBOLS[Math.floor(Math.random() * TRACKED_SYMBOLS.length)];
      const basePrice = symbol === 'RELIANCE' ? 2500 : 1000;
      const price = basePrice + (Math.random() - 0.5) * 50;
      const change = (Math.random() - 0.5) * 10;
      
      const marketData = {
        symbol,
        price,
        change,
        changePercent: (change / price) * 100,
        volume: Math.floor(Math.random() * 1000000),
        bid: price - 0.5,
        ask: price + 0.5,
        timestamp: new Date(),
      };

      // 1. Broadcast to Kafka
      await producer.send({
        topic: 'price_updates',
        messages: [{ value: JSON.stringify(marketData) }],
      });

      // 2. Cache in Redis
      await redisClient.setEx(`market:${symbol}`, 60, JSON.stringify(marketData));

      const isGlobal = !['RELIANCE', 'TCS', 'INFY', 'WIPRO', 'HDFCBANK'].includes(symbol);
      const currencySymbol = isGlobal ? '$' : '₹';
      console.log(`📈 PRICE_TICKER: [${symbol}] ${currencySymbol}${price.toFixed(2)}`);
    } catch (err) {
      console.error('Price broadcast failed:', err);
    }
  }, 5000); // 5s interval for production realism
}

app.listen(port, async () => {
  await producer.connect();
  await redisClient.connect();
  startPriceBroadcast();
  console.log(`Market Data Service on port ${port}`);
});
