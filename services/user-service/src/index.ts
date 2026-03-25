import express from 'express';
import { Pool } from 'pg';
import dotenv from 'dotenv';
// Import CacheService from shared-types
// Note: In actual implementation, adjust import path based on project structure
import { CacheService } from '../../../packages/shared-types/src/CacheService';

dotenv.config();

const app = express();
app.use(express.json());

// Database Configuration
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 20,                    // Connection pool size
  idleTimeoutMillis: 30000,   // Close after 30 seconds
  connectionTimeoutMillis: 2000,
});

// Cache Configuration
const cache = new CacheService({
  url: process.env.REDIS_URL,
  defaultTTL: 3600,
  keyPrefix: process.env.REDIS_KEY_PREFIX || 'user'
});

/**
 * Get user profile (Cache-Aside Pattern)
 * - Tries cache first
 * - If not found, queries DB
 * - Caches result for 1 hour
 */
app.get('/api/v1/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const startTime = Date.now();

    // Try cache first
    const cached = await cache.get(`${userId}`);
    if (cached) {
      const responseTime = Date.now() - startTime;
      return res.json({
        ...cached,
        _cached: true,
        _responseTime: `${responseTime}ms`
      });
    }

    // Query database
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    // Cache the result (1 hour)
    await cache.set(`${userId}`, user, 3600);

    const responseTime = Date.now() - startTime;
    res.json({
      ...user,
      _cached: false,
      _responseTime: `${responseTime}ms`
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

/**
 * Get user settings (Cache-Aside + Shorter TTL)
 * Settings can change frequently, so shorter TTL (4 hours)
 */
app.get('/api/v1/users/:userId/settings', async (req, res) => {
  try {
    const { userId } = req.params;

    // Try cache
    const cached = await cache.get(`${userId}:settings`);
    if (cached) {
      return res.json({ ...cached, _cached: true });
    }

    // Query database
    const result = await pool.query(
      'SELECT preferences, risk_level, notifications_enabled FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Settings not found' });
    }

    const settings = result.rows[0];
    // Cache for 4 hours
    await cache.set(`${userId}:settings`, settings, 14400);

    res.json(settings);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

/**
 * Update user profile (Write-Through Pattern)
 * - Updates database
 * - Invalidates all cached versions
 * - Returns updated data
 */
app.put('/api/v1/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, email, preferences, riskLevel } = req.body;

    // Validation
    if (name && (typeof name !== 'string' || name.length < 2)) {
      return res.status(400).json({ error: 'Invalid name' });
    }
    if (email && typeof email !== 'string') {
      return res.status(400).json({ error: 'Invalid email' });
    }
    if (preferences && typeof preferences !== 'object') {
      return res.status(400).json({ error: 'Preferences must be an object' });
    }
    if (riskLevel && !['low', 'medium', 'high'].includes(riskLevel)) {
      return res.status(400).json({ error: 'Invalid risk level' });
    }

    // Update database
    const result = await pool.query(
      `UPDATE users SET 
        name = COALESCE($1, name), 
        email = COALESCE($2, email),
        preferences = COALESCE($3, preferences), 
        risk_level = COALESCE($4, risk_level),
        updated_at = NOW()
      WHERE id = $5 
      RETURNING *`,
      [name, email, preferences ? JSON.stringify(preferences) : null, riskLevel, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    // Invalidate cache patterns
    await cache.deletePattern(`${userId}:*`);

    console.log(`✅ User ${userId} updated, cache invalidated`);

    res.json({
      ...user,
      message: 'User updated successfully'
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

/**
 * Update user settings (Write-Through Pattern)
 */
app.put('/api/v1/users/:userId/settings', async (req, res) => {
  try {
    const { userId } = req.params;
    const { preferences, notifications_enabled, risk_level } = req.body;

    // Update database
    const result = await pool.query(
      `UPDATE users SET 
        preferences = COALESCE($1, preferences),
        notifications_enabled = COALESCE($2, notifications_enabled),
        risk_level = COALESCE($3, risk_level),
        updated_at = NOW()
      WHERE id = $4
      RETURNING preferences, notifications_enabled, risk_level`,
      [
        preferences ? JSON.stringify(preferences) : null,
        notifications_enabled,
        risk_level,
        userId
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const settings = result.rows[0];

    // Invalidate settings cache
    await cache.delete(`${userId}:settings`);
    await cache.delete(`${userId}`);

    res.json(settings);
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

/**
 * Cache Performance Metrics
 */
app.get('/api/v1/health/cache', (req, res) => {
  const stats = cache.getStats();
  res.json({
    status: cache.isReady() ? 'connected' : 'disconnected',
    stats,
    uptime: process.uptime()
  });
});

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'user-service',
    cache: cache.isReady() ? 'connected' : 'disconnected'
  });
});

/**
 * Startup
 */
app.listen(process.env.PORT || 3002, async () => {
  try {
    await cache.connect();
    console.log('✅ User Service initialized');
    console.log(`📡 Service running on port ${process.env.PORT || 3002}`);
  } catch (error) {
    console.error('❌ Failed to start User Service:', error);
    process.exit(1);
  }
});

