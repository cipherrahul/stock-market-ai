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

    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return { ...cached, _cached: true };
    }

    const price = await this.fetchPrice(symbol);

    await this.cache.set(cacheKey, price, 10);

    return { ...price, _cached: false };
  }

  /**
   * Get daily summary (24h TTL)
   */
  async getDailySummary(symbol: string): Promise<any> {
    const cacheKey = `daily:${symbol}`;

    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

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
    await this.cache.set(cacheKey, summary, 86400);
    return summary;
  }

  /**
   * Get historical data (7 day TTL)
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

    const result = await this.pool.query(
      `SELECT * FROM market_history
      WHERE symbol = $1 AND created_at > NOW() - $2::interval
      ORDER BY created_at DESC
      LIMIT $3`,
      [symbol, `${days} days`, days]
    );

    await this.cache.set(cacheKey, result.rows, 604800);
    return result.rows;
  }

  /**
   * Get user watchlist (1h TTL)
   */
  async getWatchlist(userId: string): Promise<string[]> {
    const cacheKey = `watchlist:${userId}`;
    const cached = await this.cache.get<string[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await this.pool.query(
      'SELECT symbols FROM watchlists WHERE user_id = $1',
      [userId]
    );

    const symbols = result.rows[0]?.symbols || [];
    await this.cache.set(cacheKey, symbols, 3600);
    return symbols;
  }

  /**
   * Update watchlist and invalidate cache
   */
  async updateWatchlist(userId: string, symbols: string[]): Promise<void> {
    await this.pool.query(
      'UPDATE watchlists SET symbols = $1 WHERE user_id = $2',
      [JSON.stringify(symbols), userId]
    );
    await this.cache.delete(`watchlist:${userId}`);
    console.log(`✅ Watchlist updated for user ${userId}`);
  }

  /**
   * Broadcast real-time prices (ROCKET PRECISION)
   */
  async broadcastPrices(symbols: string[]): Promise<void> {
    for (const symbol of symbols) {
      try {
        const price = await this.fetchPrice(symbol);

        // Update cache
        await this.cache.set(`price:${symbol}`, price, 10);

        // Broadcast to Kafka (INSTITUTIONAL_ULTRA_PRECISION)
        if (this.producer) {
          await this.producer.send({
            topic: 'price_updates',
            messages: [{
              key: symbol,
              value: JSON.stringify({
                symbol,
                price: price.price,
                change: price.change,
                timestamp: new Date().toISOString(),
                high_res_epoch: Date.now(),
                fidelity: 'INSTITUTIONAL_ULTRA_PRECISION'
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
   * Invalidate market cache
   */
  async invalidateMarketData(symbol?: string): Promise<void> {
    if (symbol) {
      await this.cache.deletePattern(`price:${symbol}`);
      await this.cache.deletePattern(`daily:${symbol}`);
      await this.cache.deletePattern(`history:${symbol}:*`);
    } else {
      await this.cache.deletePattern('price:*');
      await this.cache.deletePattern('daily:*');
      await this.cache.deletePattern('history:*');
    }
    console.log(`🗑️ Market cache invalidated${symbol ? ` for ${symbol}` : ''}`);
  }

  /**
   * Fetch price from market API (MANDATORY REAL-TIME)
   */
  private async fetchPrice(symbol: string): Promise<any> {
    if (!process.env.MARKET_DATA_API_KEY) {
      throw new Error(`Market Data Provider Unconfigured for ${symbol}. API Key required.`);
    }
    // Live integration logic here
    throw new Error('Live Provider Integration Pending');
  }

  async shutdown(): Promise<void> {
    await this.cache.disconnect();
    if (this.producer) {
      await this.producer.disconnect();
    }
  }
}

export default MarketCacheManager;
