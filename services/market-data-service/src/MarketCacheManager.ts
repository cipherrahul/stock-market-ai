/**
 * Market Data Service Caching Manager
 * Manages caching for real-time market data with aggressive TTLs
 */

import { CacheService } from '@shared-types/CacheService';
import { Kafka, Producer } from 'kafkajs';
import { Pool } from 'pg';

export class MarketCacheManager {
  private cache: CacheService;
  private pool: Pool;
  private producer?: Producer;
  private kafka: Kafka;

  constructor(pool: Pool, kafka: Kafka) {
    this.pool = pool;
    this.kafka = kafka;
    this.cache = new CacheService({
      url: process.env.REDIS_URL,
      defaultTTL: 10, // Very short default for market data
      keyPrefix: process.env.REDIS_KEY_PREFIX || 'market'
    });
  }

  async initialize(): Promise<void> {
    await this.cache.connect();
    this.producer = this.kafka.producer();
    await this.producer.connect();
    console.log('✅ Market Cache Manager initialized');
  }

  /**
   * Get current stock price (10 sec TTL)
   * Most volatile data, needs frequent updates
   */
  async getStockPrice(symbol: string): Promise<any> {
    const cacheKey = `price:${symbol}`;

    // Try cache first
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return { ...cached, _cached: true };
    }

    // Fetch from market source
    const price = await this.fetchPrice(symbol);

    // Cache for 10 seconds (high volatility)
    await this.cache.set(cacheKey, price, 10);

    return { ...price, _cached: false };
  }

  /**
   * Get daily summary (24h TTL)
   * Stable data, doesn't change throughout day
   */
  async getDailySummary(symbol: string): Promise<any> {
    const cacheKey = `daily:${symbol}`;

    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Query from database
    const result = await this.pool.query(
      `SELECT 
        symbol,
        open,
        high,
        low,
        close,
        volume,
        DATE(created_at) as date
      FROM daily_prices
      WHERE symbol = $1
      ORDER BY created_at DESC
      LIMIT 1`,
      [symbol]
    );

    const summary = result.rows[0];

    // Cache for 24 hours
    await this.cache.set(cacheKey, summary, 86400);

    return summary;
  }

  /**
   * Get historical data (7 day TTL)
   * Very stable, low change frequency
   */
  async getHistoricalData(symbol: string, days: number = 30): Promise<any[]> {
    if (days < 1 || days > 365) {
      throw new Error('Days must be 1-365');
    }

    const cacheKey = `history:${symbol}:${days}d`;

    const cached = await this.cache.get<any[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Query database
    const result = await this.pool.query(
      `SELECT * FROM market_history
      WHERE symbol = $1 AND created_at > NOW() - $2::interval
      ORDER BY created_at DESC
      LIMIT $3`,
      [symbol, `${days} days`, days]
    );

    // Cache for 7 days
    await this.cache.set(cacheKey, result.rows, 604800);

    return result.rows;
  }

  /**
   * Get user watchlist (1h TTL)
   * Semi-volatile, user can modify anytime
   */
  async getWatchlist(userId: string): Promise<string[]> {
    const cacheKey = `watchlist:${userId}`;

    const cached = await this.cache.get<string[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Query database
    const result = await this.pool.query(
      'SELECT symbols FROM watchlists WHERE user_id = $1',
      [userId]
    );

    const symbols = result.rows[0]?.symbols || [];

    // Cache for 1 hour
    await this.cache.set(cacheKey, symbols, 3600);

    return symbols;
  }

  /**
   * Update watchlist and invalidate cache
   */
  async updateWatchlist(userId: string, symbols: string[]): Promise<void> {
    // Update database
    await this.pool.query(
      'UPDATE watchlists SET symbols = $1 WHERE user_id = $2',
      [JSON.stringify(symbols), userId]
    );

    // Invalidate cache
    await this.cache.delete(`watchlist:${userId}`);

    console.log(`✅ Watchlist updated for user ${userId}`);
  }

  /**
   * Broadcast real-time prices
   * Called every 5 seconds to update market data
   */
  async broadcastPrices(symbols: string[]): Promise<void> {
    for (const symbol of symbols) {
      try {
        // Fetch latest price
        const price = await this.fetchPrice(symbol);

        // Update cache with 10 sec TTL
        await this.cache.set(`price:${symbol}`, price, 10);

        // Broadcast to Kafka for subscribers
        if (this.producer) {
          await this.producer.send({
            topic: 'price_updates',
            messages: [{
              key: symbol,
              value: JSON.stringify({
                symbol,
                price: price.price,
                change: price.change,
                timestamp: new Date()
              })
            }]
          });
        }
      } catch (error) {
        console.error(`Failed to broadcast price for ${symbol}:`, error);
      }
    }
  }

  /**
   * Invalidate market cache on major events
   */
  async invalidateMarketData(symbol?: string): Promise<void> {
    if (symbol) {
      // Invalidate specific symbol
      await this.cache.deletePattern(`price:${symbol}`);
      await this.cache.deletePattern(`daily:${symbol}`);
      await this.cache.deletePattern(`history:${symbol}:*`);
    } else {
      // Invalidate all market data
      await this.cache.deletePattern('price:*');
      await this.cache.deletePattern('daily:*');
      await this.cache.deletePattern('history:*');
    }

    console.log(`🗑️ Market cache invalidated${symbol ? ` for ${symbol}` : ''}`);
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
   * Fetch price from market API or provider
   */
  private async fetchPrice(symbol: string): Promise<any> {
    // This would be replaced with actual market data API
    // For demo, returning mock data
    const basePrice = Math.random() * 1000;
    return {
      symbol,
      price: basePrice,
      change: (Math.random() - 0.5) * 10,
      bid: basePrice - 0.05,
      ask: basePrice + 0.05,
      timestamp: new Date()
    };
  }

  async shutdown(): Promise<void> {
    await this.cache.disconnect();
    if (this.producer) {
      await this.producer.disconnect();
    }
  }
}

export default MarketCacheManager;
