import express from 'express';
import { Pool } from 'pg';
import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const redisClient = createClient({ url: process.env.REDIS_URL });

// Get user profile
app.get('/api/v1/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const cached = await redisClient.get(`user:${userId}`);

    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    await redisClient.setEx(`user:${userId}`, 3600, JSON.stringify(user));

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Update user settings
app.put('/api/v1/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, preferences, riskLevel } = req.body;

    const result = await pool.query(
      'UPDATE users SET name = $1, preferences = $2, risk_level = $3 WHERE id = $4 RETURNING *',
      [name, JSON.stringify(preferences), riskLevel, userId]
    );

    await redisClient.del(`user:${userId}`);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'user-service' });
});

app.listen(process.env.PORT || 3002, async () => {
  await redisClient.connect();
  console.log(`User Service on port ${process.env.PORT || 3002}`);
});
