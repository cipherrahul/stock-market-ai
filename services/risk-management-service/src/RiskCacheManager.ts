/**
 * Risk Management Service Caching Manager
 * Manages caching for risk settings and real-time position monitoring
 */

import { CacheService } from '@shared-types/CacheService';
import { Kafka, Producer } from 'kafkajs';
import { Pool } from 'pg';

export class RiskCacheManager {
  private cache: CacheService;
  private pool: Pool;
  private producer?: Producer;
  private kafka: Kafka;

  constructor(pool: Pool, kafka: Kafka) {
    this.pool = pool;
    this.kafka = kafka;
    this.cache = new CacheService({
      url: process.env.REDIS_URL,
      defaultTTL: 60, // 1 minute default for risk data
      keyPrefix: process.env.REDIS_KEY_PREFIX || 'risk'
    });
  }

  async initialize(): Promise<void> {
    await this.cache.connect();
    this.producer = this.kafka.producer();
    await this.producer.connect();
    console.log('✅ Risk Cache Manager initialized');
  }

  /**
   * Get user risk settings (4h TTL)
   * Stable configuration, doesn't change frequently
   */
  async getRiskSettings(userId: string): Promise<any> {
    const cacheKey = `settings:${userId}`;

    // Try cache
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return { ...cached, _cached: true };
    }

    // Query database
    const result = await this.pool.query(
      `SELECT 
        *
      FROM risk_limits
      WHERE user_id = $1`,
      [userId]
    );

    const settings = result.rows[0] || {
      stop_loss_percent: 5,
      take_profit_percent: 10,
      max_single_position: 10000,
      daily_loss_limit: 50000,
      max_leverage: 2
    };

    // Cache for 4 hours (stable configuration)
    await this.cache.set(cacheKey, settings, 14400);

    return settings;
  }

  /**
   * Cache active positions for quick risk checks (1min TTL)
   * Real-time data, needs frequent updates
   */
  async cacheUserPositions(userId: string): Promise<any[]> {
    const cacheKey = `positions:${userId}`;

    // Query from database
    const result = await this.pool.query(
      `SELECT 
        id,
        symbol,
        quantity,
        avg_price,
        entry_time,
        updated_at
      FROM positions
      WHERE user_id = $1 AND quantity > 0
      ORDER BY quantity DESC`,
      [userId]
    );

    const positions = result.rows;

    // Cache for 1 minute (frequently changes)
    await this.cache.set(cacheKey, positions, 60);

    return positions;
  }

  /**
   * Get cached positions (for quick access)
   */
  async getPositions(userId: string): Promise<any[]> {
    const cacheKey = `positions:${userId}`;

    // Try cache
    const cached = await this.cache.get<any[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Fall back to database
    return await this.cacheUserPositions(userId);
  }

  /**
   * Cache market prices (10 sec TTL)
   * Most volatile, needs real-time updates
   */
  async cachePrice(symbol: string, price: number): Promise<void> {
    const cacheKey = `price:${symbol}`;

    await this.cache.set(cacheKey, {
      symbol,
      price,
      timestamp: new Date()
    }, 10); // 10 second TTL
  }

  /**
   * Get cached price
   */
  async getPrice(symbol: string): Promise<number | null> {
    const cacheKey = `price:${symbol}`;
    const cached = await this.cache.get<any>(cacheKey);
    return cached?.price || null;
  }

  /**
   * Check risk for a user's position
   * High-frequency operation, benefits from caching
   */
  async checkRisk(userId: string, symbol: string, currentPrice: number): Promise<any> {
    // Get cached settings and positions
    const settings = await this.getRiskSettings(userId);
    const positions = await this.getPositions(userId);

    const position = positions.find(p => p.symbol === symbol);
    if (!position) {
      return { risk: 'none', message: 'No position found' };
    }

    const pnl = (currentPrice - position.avg_price) * position.quantity;
    const pnlPercent = ((currentPrice - position.avg_price) / position.avg_price) * 100;

    // Check stop-loss
    if (settings.stop_loss_percent && pnlPercent <= -settings.stop_loss_percent) {
      return {
        risk: 'STOP_LOSS',
        triggered: true,
        message: `Stop-loss triggered: ${pnlPercent.toFixed(2)}%`,
        pnl,
        pnlPercent
      };
    }

    // Check take-profit
    if (settings.take_profit_percent && pnlPercent >= settings.take_profit_percent) {
      return {
        risk: 'TAKE_PROFIT',
        triggered: true,
        message: `Take-profit triggered: ${pnlPercent.toFixed(2)}%`,
        pnl,
        pnlPercent
      };
    }

    // Check daily loss limit
    const dailyLoss = await this.calculateDailyLoss(userId);
    if (settings.daily_loss_limit && dailyLoss > settings.daily_loss_limit) {
      return {
        risk: 'DAILY_LIMIT',
        triggered: true,
        message: `Daily loss limit exceeded: ₹${dailyLoss}`,
        dailyLoss
      };
    }

    return {
      risk: 'normal',
      triggered: false,
      pnl,
      pnlPercent,
      warningLevel: Math.abs(pnlPercent) > settings.stop_loss_percent * 0.5 ? 'high' : 'normal'
    };
  }

  /**
   * Update risk settings and invalidate cache
   */
  async updateRiskSettings(userId: string, settings: any): Promise<void> {
    // Update database
    await this.pool.query(
      `UPDATE risk_limits SET 
        stop_loss_percent = $1,
        take_profit_percent = $2,
        max_single_position = $3,
        daily_loss_limit = $4,
        max_leverage = $5,
        updated_at = NOW()
      WHERE user_id = $6`,
      [
        settings.stop_loss_percent,
        settings.take_profit_percent,
        settings.max_single_position,
        settings.daily_loss_limit,
        settings.max_leverage,
        userId
      ]
    );

    // Invalidate cache
    await this.cache.delete(`settings:${userId}`);

    // Publish event
    if (this.producer) {
      await this.producer.send({
        topic: 'risk_settings_updated',
        messages: [{
          value: JSON.stringify({
            event: 'RISK_SETTINGS_UPDATED',
            userId,
            settings,
            timestamp: new Date()
          })
        }]
      });
    }

    console.log(`✅ Risk settings updated for user ${userId}`);
  }

  /**
   * Handle trade execution - update positions cache
   */
  async onTradeExecuted(userId: string, symbol: string, side: string, quantity: number, price: number): Promise<void> {
    // Invalidate positions cache
    await this.cache.delete(`positions:${userId}`);

    // Re-cache updated positions
    await this.cacheUserPositions(userId);

    // Check risk for this trade
    const risk = await this.checkRisk(userId, symbol, price);
    if (risk.triggered) {
      // Send alert
      if (this.producer) {
        await this.producer.send({
          topic: 'risk_alerts',
          messages: [{
            value: JSON.stringify({
              event: risk.risk,
              userId,
              symbol,
              message: risk.message,
              timestamp: new Date()
            })
          }]
        });
      }
    }

    console.log(`✅ Trade executed - Risk cache updated`);
  }

  /**
   * Handle price update - check all affected positions
   */
  async onPriceUpdate(symbol: string, price: number): Promise<void> {
    // Cache the price
    await this.cachePrice(symbol, price);

    // Find all users with this symbol
    const result = await this.pool.query(
      'SELECT DISTINCT user_id FROM positions WHERE symbol = $1 AND quantity > 0',
      [symbol]
    );

    // Check risk for each user
    for (const row of result.rows) {
      const risk = await this.checkRisk(row.user_id, symbol, price);
      
      if (risk.triggered) {
        // Send risk alert
        if (this.producer) {
          await this.producer.send({
            topic: 'risk_alerts',
            messages: [{
              value: JSON.stringify({
                event: risk.risk,
                userId: row.user_id,
                symbol,
                message: risk.message,
                timestamp: new Date()
              })
            }]
          });
        }
      }
    }
  }

  /**
   * Invalidate position cache after market events
   */
  async invalidatePositions(userId?: string): Promise<void> {
    if (userId) {
      await this.cache.delete(`positions:${userId}`);
    } else {
      await this.cache.deletePattern('positions:*');
    }

    console.log(`🗑️ Position cache invalidated${userId ? ` for ${userId}` : ''}`);
  }

  /**
   * Get cache metrics
   */
  getMetrics(): any {
    const stats = this.cache.getStats();
    return {
      cacheStatus: this.cache.isReady() ? 'connected' : 'disconnected',
      stats,
      timestamp: new Date()
    };
  }

  /**
   * Helper: Calculate daily loss
   */
  private async calculateDailyLoss(userId: string): Promise<number> {
    const result = await this.pool.query(
      `SELECT SUM(pnl) as total_loss
      FROM trades
      WHERE user_id = $1 AND DATE(created_at) = CURRENT_DATE AND pnl < 0`,
      [userId]
    );

    return result.rows[0]?.total_loss || 0;
  }

  async shutdown(): Promise<void> {
    await this.cache.disconnect();
    if (this.producer) {
      await this.producer.disconnect();
    }
  }
}

export default RiskCacheManager;
