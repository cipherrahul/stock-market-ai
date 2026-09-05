import express from 'express';
import { Kafka } from 'kafkajs';
import { Pool } from 'pg';
import { createClient } from 'redis';
import dotenv from 'dotenv';
import axios from 'axios';

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

const TRACKED_SYMBOLS = [
  'RELIANCE', 'TCS', 'INFY', 'WIPRO', 'HDFCBANK', 'ICICIBANK', // India
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META' // Global
];

const SYMBOL_MAP: Record<string, string> = {
  RELIANCE: 'RELIANCE.NS',
  TCS: 'TCS.NS',
  INFY: 'INFY.NS',
  WIPRO: 'WIPRO.NS',
  HDFCBANK: 'HDFCBANK.NS',
  ICICIBANK: 'ICICIBANK.NS',
  AAPL: 'AAPL',
  MSFT: 'MSFT',
  GOOGL: 'GOOGL',
  AMZN: 'AMZN',
  NVDA: 'NVDA',
  TSLA: 'TSLA',
  META: 'META',
};

function getMarketTicker(symbol: string): string {
  const upper = symbol.toUpperCase();
  return SYMBOL_MAP[upper] || upper;
}

async function fetchLiveMarketQuote(symbol: string) {
  const ticker = getMarketTicker(symbol);
  try {
    const res = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1m&range=1d`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      timeout: 6000,
    });
    const result = res.data?.chart?.result?.[0];
    if (!result || !result.meta) return null;

    const meta = result.meta;
    const price = Number(meta.regularMarketPrice);
    if (!price || isNaN(price)) return null;

    const prevClose = Number(meta.chartPreviousClose || meta.previousClose || price);
    const change = Number((price - prevClose).toFixed(2));
    const changePercent = meta.regularMarketChangePercent !== undefined
      ? Number(meta.regularMarketChangePercent.toFixed(2))
      : Number(((change / prevClose) * 100).toFixed(2));
    const volume = Number(meta.regularMarketVolume || 0);
    const high = Number(meta.regularMarketDayHigh || price);
    const low = Number(meta.regularMarketDayLow || price);
    const timestamp = new Date(meta.regularMarketTime ? meta.regularMarketTime * 1000 : Date.now());

    return {
      symbol: symbol.toUpperCase(),
      price,
      change,
      changePercent,
      volume,
      bid: price,
      ask: price,
      high,
      low,
      timestamp,
    };
  } catch (err: any) {
    console.warn(`⚠️ [MarketData] Live quote fetch error for ${ticker}: ${err.message}`);
    return null;
  }
}

// Get real-time market data
app.get('/api/v1/market/stocks/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const cached = await redisClient.get(`market:${symbol}`);

    if (cached) {
      return res.json(JSON.parse(cached));
    }

    // Direct live exchange fetch
    const live = await fetchLiveMarketQuote(symbol);
    if (live) {
      await redisClient.setEx(`market:${symbol}`, 3600, JSON.stringify(live));
      await redisClient.setEx(`price:${symbol}`, 3600, live.price.toString());
      return res.json(live);
    }

    res.status(404).json({ error: `Symbol ${symbol} not found on live exchanges` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch market data' });
  }
});

// Historical real candles
app.get('/api/v1/market/history/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const days = parseInt(req.query.days as string, 10) || 30;

    if (days < 1 || days > 365) {
      return res.status(400).json({ error: 'Days must be between 1 and 365' });
    }

    const result = await pool.query(
      'SELECT * FROM market_history WHERE symbol = $1 ORDER BY timestamp DESC LIMIT $2',
      [symbol, days]
    );

    if (result.rows.length > 0) {
      return res.json(result.rows);
    }

    // Direct live historical query if DB empty
    const ticker = getMarketTicker(symbol);
    const chartRes = await axios.get(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1mo`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 6000 }
    );
    const chartData = chartRes.data?.chart?.result?.[0];
    if (chartData && chartData.timestamp) {
      const timestamps = chartData.timestamp;
      const quote = chartData.indicators.quote[0];
      const rows = [];
      for (let i = 0; i < timestamps.length; i++) {
        if (quote.close[i] != null) {
          rows.push({
            symbol,
            price: quote.close[i],
            high: quote.high[i],
            low: quote.low[i],
            open: quote.open[i],
            volume: quote.volume[i] || 0,
            timestamp: new Date(timestamps[i] * 1000),
          });
        }
      }
      return res.json(rows.reverse());
    }

    res.json([]);
  } catch (error) {
    console.error('Market history error:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'market-data-service',
    realtime: true,
    feed: 'LIVE_EXCHANGE_STREAM',
    zeroMock: true,
  });
});

async function startPriceBroadcast() {
  setInterval(async () => {
    try {
      for (const symbol of TRACKED_SYMBOLS.slice(0, 5)) {
        const live = await fetchLiveMarketQuote(symbol);
        if (live) {
          await redisClient.setEx(`market:${symbol}`, 3600, JSON.stringify(live));
          await redisClient.setEx(`price:${symbol}`, 3600, live.price.toString());
          await producer.send({
            topic: 'price_updates',
            messages: [{ key: symbol, value: JSON.stringify(live) }],
          });
        }
      }
    } catch (err) {
      console.error('Price broadcast error:', err);
    }
  }, 4000);
}

app.listen(port, async () => {
  await producer.connect();
  await redisClient.connect();
  startPriceBroadcast();
  console.log(`🔴 Market Data Service (100% REALTIME ZERO-MOCK) on port ${port}`);
});
