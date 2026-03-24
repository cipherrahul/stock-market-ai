import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { createClient } from 'redis';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Redis connection
const redisClient = createClient({
  url: process.env.REDIS_URL,
});

redisClient.connect().catch(console.error);

// Types
interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

// Routes
app.post('/api/v1/auth/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    // Validate input
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const result = await pool.query(
      'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name',
      [email, hashedPassword, name]
    );

    res.status(201).json({
      message: 'User registered successfully',
      user: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/v1/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Find user
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate tokens
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role || 'user',
      } as TokenPayload,
      process.env.JWT_SECRET || 'secret',
      { expiresIn: process.env.JWT_EXPIRY || '24h' }
    );

    // Cache token in Redis
    await redisClient.setEx(`token:${user.id}`, 86400, token);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/v1/auth/verify', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as TokenPayload;

    res.json({
      valid: true,
      user: decoded,
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

app.post('/api/v1/auth/logout', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as TokenPayload;
      await redisClient.del(`token:${decoded.userId}`);
    }

    res.json({ message: 'Logout successful' });
  } catch (error) {
    res.status(500).json({ error: 'Logout failed' });
  }
});

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', service: 'auth-service' });
});

app.listen(port, () => {
  console.log(`Auth Service listening on port ${port}`);
});
