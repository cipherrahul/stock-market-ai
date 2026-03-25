/**
 * Cache Service - Reusable across all services
 * Provides abstraction layer for Redis caching with monitoring
 * 
 * Usage:
 * const cache = new CacheService();
 * const data = await cache.get('user:123');
 * await cache.set('user:123', {...}, 3600);
 */

import { createClient, RedisClientType } from 'redis';

export interface CacheConfig {
  url?: string;
  host?: string;
  port?: number;
  defaultTTL?: number;
  keyPrefix?: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  hitRate: number;
}

export class CacheService {
  private redis!: RedisClientType;
  private isConnected = false;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    hitRate: 0
  };

  private defaultTTL = 3600; // 1 hour
  private keyPrefix = '';

  constructor(config?: CacheConfig) {
    this.defaultTTL = config?.defaultTTL || 3600;
    this.keyPrefix = config?.keyPrefix || '';

    const redisUrl =
      config?.url ||
      process.env.REDIS_URL ||
      `redis://${config?.host || 'localhost'}:${config?.port || 6379}`;

    this.redis = createClient({ url: redisUrl });

    this.redis.on('error', (err) => {
      console.error('❌ Redis error:', err);
      this.isConnected = false;
    });

    this.redis.on('connect', () => {
      console.log('✅ Redis connected');
      this.isConnected = true;
    });
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    if (this.isConnected) return;
    await this.redis.connect();
    this.isConnected = true;
    console.log('✅ Cache service initialized');
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.redis.quit();
      this.isConnected = false;
    }
  }

  /**
   * Get value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    try {
      const fullKey = this.buildKey(key);
      const data = await this.redis.get(fullKey);

      if (data) {
        this.stats.hits++;
        return JSON.parse(data) as T;
      } else {
        this.stats.misses++;
        return null;
      }
    } catch (error) {
      console.error(`❌ Cache GET error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set(
    key: string,
    value: any,
    ttl?: number
  ): Promise<void> {
    try {
      const fullKey = this.buildKey(key);
      const expiresIn = ttl || this.defaultTTL;

      await this.redis.setEx(
        fullKey,
        expiresIn,
        JSON.stringify(value)
      );

      this.stats.sets++;
    } catch (error) {
      console.error(`❌ Cache SET error for key ${key}:`, error);
    }
  }

  /**
   * Delete key from cache
   */
  async delete(key: string): Promise<void> {
    try {
      const fullKey = this.buildKey(key);
      await this.redis.del(fullKey);
      this.stats.deletes++;
    } catch (error) {
      console.error(`❌ Cache DELETE error for key ${key}:`, error);
    }
  }

  /**
   * Delete multiple keys matching pattern
   */
  async deletePattern(pattern: string): Promise<void> {
    try {
      const fullPattern = this.buildKey(pattern);
      const keys = await this.redis.keys(fullPattern);

      if (keys.length > 0) {
        await this.redis.del(keys);
        this.stats.deletes += keys.length;
        console.log(`🗑️ Deleted ${keys.length} cache keys matching ${pattern}`);
      }
    } catch (error) {
      console.error(`❌ Cache DELETE PATTERN error for ${pattern}:`, error);
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    try {
      await this.redis.flushDb();
      console.log('🗑️ Cache cleared');
    } catch (error) {
      console.error('❌ Cache CLEAR error:', error);
    }
  }

  /**
   * Get or compute cache
   */
  async getOrSet<T = any>(
    key: string,
    computeFn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Try cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Compute if not cached
    const value = await computeFn();
    await this.set(key, value, ttl);
    return value;
  }

  /**
   * Increment counter
   */
  async increment(key: string, amount: number = 1): Promise<number> {
    try {
      const fullKey = this.buildKey(key);
      return await this.redis.incrBy(fullKey, amount);
    } catch (error) {
      console.error(`❌ Cache INCREMENT error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? 
      (this.stats.hits / total) * 100 : 0;
    
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      hitRate: 0
    };
  }

  /**
   * Get Redis info
   */
  async getInfo(): Promise<any> {
    try {
      const info = await this.redis.info();
      return info;
    } catch (error) {
      console.error('❌ Cache INFO error:', error);
      return null;
    }
  }

  /**
   * Monitor cache performance
   */
  async monitorPerformance(): Promise<void> {
    const stats = this.getStats();
    console.log('📊 Cache Performance Stats:');
    console.log(`   Hits: ${stats.hits}`);
    console.log(`   Misses: ${stats.misses}`);
    console.log(`   Hit Rate: ${stats.hitRate.toFixed(2)}%`);
    console.log(`   Sets: ${stats.sets}`);
    console.log(`   Deletes: ${stats.deletes}`);
  }

  /**
   * Build full key with prefix
   */
  private buildKey(key: string): string {
    if (this.keyPrefix) {
      return `${this.keyPrefix}:${key}`;
    }
    return key;
  }

  /**
   * Check connection status
   */
  isReady(): boolean {
    return this.isConnected;
  }

  /**
   * Batch get multiple keys
   */
  async mget(keys: string[]): Promise<(any | null)[]> {
    try {
      const fullKeys = keys.map(k => this.buildKey(k));
      const values = await this.redis.mGet(fullKeys);
      
      return values.map(v => {
        if (v) {
          this.stats.hits++;
          return JSON.parse(v);
        }
        this.stats.misses++;
        return null;
      });
    } catch (error) {
      console.error('❌ Cache MGET error:', error);
      return keys.map(() => null);
    }
  }

  /**
   * Batch set multiple keys
   */
  async mset(keyValues: { key: string; value: any; ttl?: number }[]): Promise<void> {
    try {
      for (const item of keyValues) {
        await this.set(item.key, item.value, item.ttl);
      }
    } catch (error) {
      console.error('❌ Cache MSET error:', error);
    }
  }
}

/**
 * Pattern: Cache-Aside Decorator
 * Usage: Place in class with @CacheAside decorator on methods
 * Note: Class must have a 'cache' property of type CacheService
 */
export function CacheAside(keyTemplate: string, ttl: number = 3600) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: any
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // This uses the instance's cache property
      if (!this || !this.cache) {
        // Fall back to original method if cache not available
        return originalMethod.apply(this, args);
      }

      const cache = this.cache as CacheService;

      // Build cache key from template and args
      let cacheKey = keyTemplate;
      for (let i = 0; i < args.length; i++) {
        cacheKey = cacheKey.replace(`{${i}}`, String(args[i]));
      }

      // Try cache
      const cached = await cache.get(cacheKey);
      if (cached !== null) {
        return cached;
      }

      // Call original method
      const result = await originalMethod.apply(this, args);

      // Cache result
      await cache.set(cacheKey, result, ttl);

      return result;
    };

    return descriptor;
  };
}

/**
 * Pattern: Invalidation on method call
 * Usage: @CacheInvalidate('user:{0}:*')
 * Note: Class must have a 'cache' property of type CacheService
 */
export function CacheInvalidate(pattern: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: any
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Call original method
      const result = await originalMethod.apply(this, args);

      // Invalidate cache if available
      if (this && this.cache) {
        const cache = this.cache as CacheService;
        let invalidatePattern = pattern;
        for (let i = 0; i < args.length; i++) {
          invalidatePattern = invalidatePattern.replace(`{${i}}`, String(args[i]));
        }
        await cache.deletePattern(invalidatePattern);
      }

      return result;
    };

    return descriptor;
  };
}

export default CacheService;
export { CacheService, CacheConfig, CacheStats, CacheAside, CacheInvalidate };
