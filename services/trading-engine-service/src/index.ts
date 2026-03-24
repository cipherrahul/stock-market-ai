import express from 'express';
import { Kafka } from 'kafkajs';
import { Pool } from 'pg';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const kafka = new Kafka({
  clientId: 'trading-engine-service',
  brokers: [(process.env.KAFKA_BROKER || 'localhost:9092')],
});

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Execute trade
app.post('/api/v1/trading/execute', async (req, res) => {
  try {
    const { userId, symbol, quantity, side, price } = req.body;

    // Validate risk
    const portfolio = await axios.get(
      `${process.env.PORTFOLIO_SERVICE_URL}/api/v1/portfolio/${userId}`
    );

    // Risk check
    const riskAmount = price * quantity;
    if (riskAmount > process.env.MAX_POSITION_SIZE) {
      return res.status(400).json({ error: 'Position size exceeds limit' });
    }

    // Send to broker
    const brokerResponse = await axios.post(
      `${process.env.BROKER_SERVICE_URL}/api/v1/broker/execute`,
      { symbol, quantity, side, price }
    );

    // Store order
    const result = await pool.query(
      'INSERT INTO orders (user_id, symbol, quantity, side, price, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [userId, symbol, quantity, side, price, 'executed']
    );

    res.json({
      orderId: result.rows[0].id,
      status: 'executed',
      brokerOrderId: brokerResponse.data.orderId,
    });
  } catch (error) {
    res.status(500).json({ error: 'Trade execution failed' });
  }
});

// Check portfolio limits
app.get('/api/v1/trading/limits/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await pool.query(
      'SELECT SUM(quantity * price) as total_value FROM orders WHERE user_id = $1 AND status = $2',
      [userId, 'executed']
    );

    res.json({
      totalPositionValue: result.rows[0]?.total_value || 0,
      maxPositionSize: process.env.MAX_POSITION_SIZE,
      canTrade: (result.rows[0]?.total_value || 0) < process.env.MAX_POSITION_SIZE,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch limits' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'trading-engine-service' });
});

app.listen(process.env.PORT || 3006, () => {
  console.log(`Trading Engine Service on port ${process.env.PORT || 3006}`);
});
