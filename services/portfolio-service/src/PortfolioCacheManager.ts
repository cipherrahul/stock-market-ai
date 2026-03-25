/**
 * Portfolio Service Caching Enhancement
 * Integrates CacheService with existing portfolio logic
 * 
 * Key caching points:
 * - Portfolio summary (5min TTL) - fast queries
 * - Positions (5min TTL) - frequently accessed
 * - P&L calculations (1min TTL) - most volatile
 * - Daily summaries (24h TTL) - stable data
 */

import { CacheService } from '@shared-types/CacheService';
import { Pool } from 'pg';
import { Kafka, Producer } from 'kafkajs';

export class PortfolioCacheManager {
  private cache: CacheService;
  private pool: Pool;
  private kafka: Kafka;
  private producer?: Producer;

  constructor(pool: Pool, kafka: Kafka) {
    this.pool = pool;
    this.kafka = kafka;
    this.cache = new CacheService({
      url: process.env.REDIS_URL,
      defaultTTL: 300, // 5 minutes for portfolio data
      keyPrefix: process.env.REDIS_KEY_PREFIX || 'portfolio'
    });
  }

  /**
   * Initialize cache manager
   */
  async initialize(): Promise<void> {
    await this.cache.connect();
    this.producer = this.kafka.producer();
    await this.producer.connect();
    console.log('✅ Portfolio Cache Manager initialized');
  }

  /**
   * Get portfolio summary with caching
   * Cache-Aside Pattern: Try cache -> Query DB -> Cache result
   */
  async getPortfolioSummary(userId: string, isPaper: boolean = false): Promise<any> {
    const cacheKey = this.buildCacheKey('summary', userId, isPaper);

    try {
      // Try cache first
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        console.log(`✅ Cache HIT for portfolio:${userId}`);
        return { ...cached, _cached: true };
      }

      console.log(`❌ Cache MISS for portfolio:${userId}, querying DB`);

      // Query database
      const summary = await this.calculatePortfolioSummary(userId, isPaper);

      // Cache for 5 minutes
      await this.cache.set(cacheKey, summary, 300);

      return { ...summary, _cached: false };
    } catch (error) {
      console.error('Error getting portfolio summary:', error);
      // Fallback to database query
      return await this.calculatePortfolioSummary(userId, isPaper);
    }
  }

  /**
   * Calculate portfolio summary (actual DB query)
   */
  private async calculatePortfolioSummary(userId: string, isPaper: boolean): Promise<any> {
    const startTime = Date.now();

    // Get positions
    const positions = await this.getPositions(userId, isPaper);

    // Get cash balance
    const balanceResult = await this.pool.query(
      'SELECT COALESCE(SUM(cash), 0) as total_cash FROM portfolios WHERE user_id = $1 AND is_paper = $2',
      [userId, isPaper]
    );
    const totalCash = balanceResult.rows[0].total_cash;

    // Calculate total value
    let totalValue = totalCash;
    for (const pos of positions) {
      totalValue += pos.quantity * pos.avg_price;
    }

    // Calculate P&L
    const pnl = await this.calculatePnL(userId, isPaper);

    const calculationTime = Date.now() - startTime;

    return {
      userId,
      positions: positions.length,
      totalValue,
      totalCash,
      pnl,
      isPaper,
      calculationTime: `${calculationTime}ms`,
      updatedAt: new Date()
    };
  }

  /**
   * Get positions with caching
   * Shorter TTL (5min) for real-time accuracy
   */
  async getPositions(userId: string, isPaper: boolean = false): Promise<any[]> {
    const cacheKey = this.buildCacheKey('positions', userId, isPaper);

    // Try cache
    let positions = await this.cache.get<any[]>(cacheKey);
    if (positions) {
      console.log(`✅ Positions cache HIT for user:${userId}`);
      return positions;
    }

    // Query database
    const result = await this.pool.query(
      `SELECT 
        symbol,
        SUM(CASE WHEN side = 'BUY' THEN quantity ELSE -quantity END) as quantity,
        AVG(price) as avg_price,
        MAX(created_at) as last_update
      FROM orders 
      WHERE user_id = $1 AND is_paper = $2 AND status = 'EXECUTED'
      GROUP BY symbol
      HAVING SUM(CASE WHEN side = 'BUY' THEN quantity ELSE -quantity END) > 0`,
      [userId, isPaper]
    );

    positions = result.rows;

    // Cache for 5 minutes
    await this.cache.set(cacheKey, positions, 300);

    return positions;
  }

  /**
   * Get P&L with aggressive caching
   * More volatile than positions, so shorter TTL (1min)
   */
  async calculatePnL(userId: string, isPaper: boolean = false): Promise<any> {
    const cacheKey = this.buildCacheKey('pnl', userId, isPaper);

    // Try cache first
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Query database for realized and unrealized P&L
    const result = await this.pool.query(
      `SELECT 
        SUM(CASE WHEN side='SELL' THEN quantity * price ELSE -quantity * price END) as realized_pnl,
        COUNT(*) as trade_count
      FROM orders
      WHERE user_id = $1 AND is_paper = $2 AND status = 'EXECUTED'`,
      [userId, isPaper]
    );

    const pnl = {
      realized: result.rows[0]?.realized_pnl || 0,
      tradeCount: result.rows[0]?.trade_count || 0,
      calculatedAt: new Date()
    };

    // Cache for 1 minute (very volatile data)
    await this.cache.set(cacheKey, pnl, 60);

    return pnl;
  }

  /**
   * Get daily portfolio summary (not volatile, long TTL)
   */
  async getDailySummary(userId: string, isPaper: boolean = false): Promise<any> {
    const cacheKey = this.buildCacheKey('daily', userId, isPaper);

    // Try cache
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Query from history table
    const result = await this.pool.query(
      `SELECT 
        DATE(created_at) as date,
        MAX(total_value) as max_value,
        MIN(total_value) as min_value,
        AVG(total_value) as avg_value,
        LAST(pnl) as end_pnl
      FROM portfolio_history
      WHERE user_id = $1 AND is_paper = $2
      GROUP BY DATE(created_at)
      ORDER BY date DESC`,
      [userId, isPaper]
    );

    // Cache for 24 hours
    await this.cache.set(cacheKey, result.rows, 86400);

    return result.rows;
  }

  /**
   * Invalidate portfolio cache on update
   * Called after deposits, trades, etc.
   */
  async invalidatePortfolioCache(userId: string, isPaper?: boolean): Promise<void> {
    // Invalidate all related cache keys
    const patterns = [
      this.buildCacheKey('summary', userId, isPaper || false),
      this.buildCacheKey('summary', userId, true),
      this.buildCacheKey('positions', userId, isPaper || false),
      this.buildCacheKey('positions', userId, true),
      this.buildCacheKey('pnl', userId, isPaper || false),
      this.buildCacheKey('pnl', userId, true),
    ];

    for (const pattern of patterns) {
      await this.cache.delete(pattern);
    }

    console.log(`🗑️ Invalidated portfolio cache for user:${userId}`);

    // Publish invalidation event
    if (this.producer) {
      await this.producer.send({
        topic: 'cache_invalidation',
        messages: [{
          value: JSON.stringify({
            event: 'PORTFOLIO_INVALIDATED',
            userId,
            timestamp: new Date()
          })
        }]
      });
    }
  }

  /**
   * Handle trade execution with cache invalidation
   */
  async onTradeExecuted(userId: string, symbol: string, side: string, quantity: number, price: number, isPaper: boolean): Promise<void> {
    // Invalidate user's portfolio cache
    await this.invalidatePortfolioCache(userId, isPaper);

    // Also invalidate other users' portfolios if they hold this symbol
    const affected = await this.pool.query(
      `SELECT DISTINCT user_id FROM positions WHERE symbol = $1 AND user_id != $2`,
      [symbol, userId]
    );

    for (const row of affected.rows) {
      await this.invalidatePortfolioCache(row.user_id, isPaper);
    }

    console.log(`✅ Trade executed - Cache invalidated for affected users`);
  }

  /**
   * Handle deposit with cache invalidation
   */
  async onDepositReceived(userId: string, amount: number): Promise<void> {
    await this.invalidatePortfolioCache(userId);
  }

  /**
   * Handle withdrawal with cache invalidation
   */
  async onWithdrawalProcessed(userId: string, amount: number): Promise<void> {
    await this.invalidatePortfolioCache(userId);
  }

  /**
   * Monitor cache metrics
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
   * Shutdown
   */
  async shutdown(): Promise<void> {
    await this.cache.disconnect();
    if (this.producer) {
      await this.producer.disconnect();
    }
    console.log('✅ Portfolio Cache Manager shutdown');
  }

  /**
   * Build cache key with prefix
   */
  private buildCacheKey(type: string, userId: string, isPaper: boolean): string {
    const prefix = isPaper ? 'paper' : 'live';
    return `${prefix}:${userId}:${type}`;
  }
}

/**
 * Integration with Express app
 * 
 * Usage:
 * import { portfolioManager } from './portfolio-manager';
 * 
 * app.get('/api/v1/portfolio/:userId/summary', async (req, res) => {
 *   const summary = await portfolioManager.getPortfolioSummary(req.params.userId);
 *   res.json(summary);
 * });
 * 
 * app.post('/api/v1/portfolio/trade', async (req, res) => {
 *   // Execute trade...
 *   await portfolioManager.onTradeExecuted(userId, symbol, side, qty, price);
 *   res.json({ message: 'Trade executed' });
 * });
 */

export default PortfolioCacheManager;
