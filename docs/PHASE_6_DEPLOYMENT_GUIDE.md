# Phase 6: Performance Optimization & Caching - Deployment Guide

## Overview
Phase 6 focuses on achieving 50% faster API responses through Redis caching, query optimization, and CDN integration. Expected to reduce API P95 from 100ms to <50ms.

**Timeline**: 3 weeks (100-120 total hours)
- Week 1: Redis setup + service caching (40-50 hrs)
- Week 2: Query optimization + connection pooling (30-40 hrs)
- Week 3: Response compression + CDN (30-40 hrs)

---

## WEEK 1: Redis Setup & Caching Integration

### 1.1 Redis Architecture Design

#### Single Node (Development)
```yaml
redis:
  image: redis:7-alpine
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
  environment:
    - REDIS_CONFIG=/usr/local/etc/redis/redis.conf
```

#### Master-Replica (Staging)
```yaml
# redis-master
redis-master:
  image: redis:7-alpine
  ports:
    - "6379:6379"
  command: redis-server --appendonly yes
  volumes:
    - redis-master-data:/data

# redis-replica
redis-replica:
  image: redis:7-alpine
  ports:
    - "6380:6379"
  command: redis-server --slaveof redis-master 6379 --appendonly yes
  volumes:
    - redis-replica-data:/data
  depends_on:
    - redis-master
```

#### High Availability (Production) - Redis Sentinel
```yaml
# Master
redis-master:
  image: redis:7-alpine
  command: redis-server --port 6379 --protected-mode no
  volumes:
    - redis-master-data:/data

# Replicas
redis-replica-1:
  image: redis:7-alpine
  command: redis-server --port 6380 --slaveof redis-master 6379
  volumes:
    - redis-replica-1-data:/data

redis-replica-2:
  image: redis:7-alpine
  command: redis-server --port 6381 --slaveof redis-master 6379
  volumes:
    - redis-replica-2-data:/data

# Sentinels for failover
redis-sentinel-1:
  image: redis:7-alpine
  command: redis-sentinel /etc/sentinel.conf --port 26379
  volumes:
    - ./sentinel.conf:/etc/sentinel.conf
  ports:
    - "26379:26379"
```

**Sentinel Configuration** (`sentinel.conf`):
```bash
port 26379
sentinel monitor mymaster redis-master 6379 2
sentinel down-after-milliseconds mymaster 5000
sentinel parallel-syncs mymaster 1
sentinel failover-timeout mymaster 10000
```

### 1.2 Redis Configuration Optimization

**Production Redis Config** (`redis.conf`):
```bash
# Memory Management
maxmemory 2gb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000

# Persistence
appendonly yes
appendfsync everysec

# Replication
repl-diskless-sync yes
repl-diskless-sync-delay 5

# Network
tcp-backlog 511
timeout 0
tcp-keepalive 300

# Logging
loglevel notice
logfile ""

# Cluster (if using Cluster mode)
cluster-enabled no
```

### 1.3 Environment Configuration

**.env for Redis Setup**:
```bash
# Development
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_URL=redis://localhost:6379

# Staging (with replica)
REDIS_MASTER=redis-master:6379
REDIS_REPLICA=redis-replica:6380
REDIS_REPLICATION_ENABLED=true

# Production (with Sentinel)
REDIS_SENTINEL_ENABLED=true
REDIS_SENTINEL_NODES=redis-sentinel-1:26379,redis-sentinel-2:26379,redis-sentinel-3:26379
REDIS_SENTINEL_SERVICE_NAME=mymaster
REDIS_PASSWORD=${REDIS_PASSWORD}

# Cache Configuration
REDIS_DEFAULT_TTL=3600
REDIS_KEY_PREFIX=prod:
REDIS_POOL_SIZE=10
REDIS_POOL_TIMEOUT=5000
```

---

## WEEK 1: Caching Integration

### 2.1 Cache Patterns

#### Pattern 1: Cache-Aside (Most Common)
```typescript
// Pseudocode
async function getUserData(userId: string) {
  // 1. Try cache
  const cached = await redis.get(`user:${userId}`);
  if (cached) return JSON.parse(cached);

  // 2. Query DB
  const user = await db.query('SELECT * FROM users WHERE id = $1', [userId]);

  // 3. Store in cache (TTL: 1 hour)
  await redis.setEx(`user:${userId}`, 3600, JSON.stringify(user));

  return user;
}
```

**Best for**: User profiles, settings, market data

#### Pattern 2: Write-Through Cache
```typescript
async function updateUserProfile(userId: string, data: any) {
  // 1. Write to cache first
  await redis.setEx(`user:${userId}`, 3600, JSON.stringify(data));

  // 2. Write to database
  await db.query('UPDATE users SET ...');

  // 3. Confirm write
  return data;
}
```

**Best for**: Critical user updates, settings changes

#### Pattern 3: Write-Behind Cache (Batch)
```typescript
const writeBuffer = new Map<string, any>();

function bufferWrite(key: string, value: any) {
  writeBuffer.set(key, value);
}

// Flush every 10 seconds
setInterval(async () => {
  for (const [key, value] of writeBuffer) {
    await db.query('UPDATE ... WHERE id = $1', [value.id]);
  }
  writeBuffer.clear();
}, 10000);
```

**Best for**: Analytics, event logs, non-critical data

#### Pattern 4: Event-Based Invalidation
```typescript
// When trade executes, invalidate portfolio cache
async function onTradeExecuted(userId: string, symbolSymbol: string) {
  // Invalidate relevant cached data
  await redis.del(`portfolio:${userId}`);
  await redis.del(`portfolio:${userId}:summary`);
  await redis.del(`user:${userId}:positions`);
  
  // Notify other services via Kafka
  await kafka.producer.send({
    topic: 'cache_invalidation',
    messages: [{
      value: JSON.stringify({
        event: 'TRADE_EXECUTED',
        userId,
        symbol,
        timestamp: new Date(),
      })
    }]
  });
}
```

**Best for**: Real-time data, portfolio updates, market changes

### 2.2 Caching by Service

#### User Service Caching

**Objects to Cache**:
- User profile: `user:{userId}` (TTL: 1 hour)
- User settings: `user:{userId}:settings` (TTL: 4 hours)
- User preferences: `user:{userId}:preferences` (TTL: 4 hours)

**Implementation**:
```typescript
// Get user with cache
async function getUser(userId: string) {
  const cacheKey = `user:${userId}`;
  let user = await redis.get(cacheKey);
  
  if (!user) {
    user = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    await redis.setEx(cacheKey, 3600, JSON.stringify(user));
  }
  
  return user;
}

// Update user with cache invalidation
async function updateUser(userId: string, updates: any) {
  await pool.query('UPDATE users SET ... WHERE id = $1', [userId]);
  await redis.del(`user:${userId}`);
  await redis.del(`user:${userId}:settings`);
  return await getUser(userId);
}
```

#### Portfolio Service Caching

**Objects to Cache**:
- Portfolio summary: `portfolio:{userId}` (TTL: 5 min - real-time)
- Positions: `portfolio:{userId}:positions` (TTL: 5 min)
- P&L: `portfolio:{userId}:pnl` (TTL: 1 min - most volatile)
- Holdings: `portfolio:{userId}:holdings` (TTL: 5 min)

**Implementation**:
```typescript
// Get portfolio with cache
async function getPortfolioSummary(userId: string) {
  const cacheKey = `portfolio:${userId}`;
  let portfolio = await redis.get(cacheKey);
  
  if (!portfolio) {
    const positions = await getPositions(userId);
    const pnl = await calculatePnL(userId);
    const balance = await getBalance(userId);
    
    portfolio = { positions, pnl, balance };
    // Shorter TTL (5 min) for real-time accuracy
    await redis.setEx(cacheKey, 300, JSON.stringify(portfolio));
  }
  
  return portfolio;
}

// On price update, invalidate portfolio P&L
async function onPriceUpdate(symbol: string, price: number) {
  // Find all users holding this symbol
  const holders = await pool.query(
    'SELECT DISTINCT user_id FROM positions WHERE symbol = $1',
    [symbol]
  );
  
  // Invalidate their portfolios
  for (const user of holders.rows) {
    await redis.del(`portfolio:${user.user_id}`);
    await redis.del(`portfolio:${user.user_id}:pnl`);
  }
}
```

#### Market Data Service Caching

**Objects to Cache**:
- Stock price: `market:{symbol}:price` (TTL: 10 sec - high volatility)
- Daily summary: `market:{symbol}:daily` (TTL: 24 hours)
- Historical data: `market:{symbol}:history:{days}` (TTL: 7 days)
- Watchlist: `watchlist:{userId}` (TTL: 1 hour)

**Implementation**:
```typescript
// Get market data with cache
async function getMarketData(symbol: string) {
  const cacheKey = `market:${symbol}`;
  let data = await redis.get(cacheKey);
  
  if (!data) {
    data = await fetchFromMarketAPI(symbol);
    // Very short TTL (10 sec) for prices
    await redis.setEx(cacheKey, 10, JSON.stringify(data));
  }
  
  return data;
}

// Real-time price updates
async function publishPriceUpdate(symbol: string, price: number) {
  const cacheKey = `market:${symbol}:price`;
  await redis.set(cacheKey, JSON.stringify({
    symbol,
    price,
    timestamp: new Date(),
  }));
  
  // Also broadcast via Kafka for subscribers
  await kafka.producer.send({
    topic: 'price_updates',
    messages: [{
      value: JSON.stringify({ symbol, price, timestamp: new Date() })
    }]
  });
}
```

#### Risk Management Service Caching

**Objects to Cache**:
- User risk settings: `risk:{userId}:settings` (TTL: 4 hours)
- Active positions: `risk:{userId}:positions` (TTL: 1 min)
- Price cache: `price:{symbol}` (TTL: 10 sec)
- Alerts: `risk:{userId}:alerts` (TTL: 1 min)

**Implementation**:
```typescript
// Get risk settings
async function getRiskSettings(userId: string) {
  const cacheKey = `risk:${userId}:settings`;
  let settings = await redis.get(cacheKey);
  
  if (!settings) {
    settings = await pool.query('SELECT preferences FROM users WHERE id = $1', [userId]);
    await redis.setEx(cacheKey, 14400, JSON.stringify(settings));
  }
  
  return settings;
}

// Cache positions for quick risk checks
async function cacheUserPositions(userId: string) {
  const positions = await pool.query(
    'SELECT * FROM positions WHERE user_id = $1 AND quantity > 0',
    [userId]
  );
  
  await redis.setEx(
    `risk:${userId}:positions`,
    60,
    JSON.stringify(positions.rows)
  );
}
```

### 2.3 Kafka Event-Based Invalidation

**Cache Invalidation Topics**:

1. **user_updated** - User profile changes
2. **portfolio_changed** - Portfolio balance updates
3. **trade_executed** - Trade completion
4. **price_updated** - Market price changes
5. **settings_changed** - User settings changes

**Kafka Consumer Implementation**:
```typescript
const consumer = kafka.consumer({ groupId: 'cache-invalidation' });

await consumer.subscribe({
  topics: ['user_updated', 'portfolio_changed', 'trade_executed', 
           'price_updated', 'settings_changed']
});

await consumer.run({
  eachMessage: async ({ topic, message }) => {
    const data = JSON.parse(message.value?.toString() || '{}');
    
    switch (topic) {
      case 'user_updated':
        await redis.del(`user:${data.userId}`);
        await redis.del(`user:${data.userId}:settings`);
        break;
        
      case 'portfolio_changed':
        await redis.del(`portfolio:${data.userId}`);
        await redis.del(`portfolio:${data.userId}:positions`);
        break;
        
      case 'trade_executed':
        // Invalidate multiple caches
        await redis.del(`portfolio:${data.userId}`);
        await redis.del(`portfolio:${data.userId}:pnl`);
        await redis.del(`portfolio:${data.userId}:positions`);
        break;
        
      case 'price_updated':
        // Invalidate all users' portfolios with this symbol
        const users = await pool.query(
          'SELECT DISTINCT user_id FROM positions WHERE symbol = $1',
          [data.symbol]
        );
        for (const user of users.rows) {
          await redis.del(`portfolio:${user.user_id}`);
        }
        break;
        
      case 'settings_changed':
        await redis.del(`user:${data.userId}:settings`);
        await redis.del(`risk:${data.userId}:settings`);
        break;
    }
  }
});
```

---

## WEEK 2: Query Optimization

### 3.1 Database Connection Pooling

**PostgreSQL Connection Pool Configuration**:
```typescript
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  
  // Connection Pool Settings
  max: 20,                    // Maximum connections
  min: 5,                     // Minimum connections
  idleTimeoutMillis: 30000,  // Close after 30sec idle
  connectionTimeoutMillis: 2000, // 2sec timeout to get connection
  
  // Performance
  max_connections: 100,      // Server-side limit
  shared_preload_libraries: 'pg_stat_statements',
});

// Use connection efficiently
async function query(sql: string, params: any[]) {
  const client = await pool.connect();
  try {
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}
```

### 3.2 Database Indexes

**New Indexes for High-Query Tables**:

```sql
-- User Service Indexes
CREATE INDEX idx_users_email ON users(email) WHERE active = true;
CREATE INDEX idx_users_created_at ON users(created_at DESC);
CREATE INDEX idx_users_status_active ON users(status, active);

-- Portfolio Service Indexes
CREATE INDEX idx_positions_user_symbol ON positions(user_id, symbol);
CREATE INDEX idx_positions_user_quantity ON positions(user_id) WHERE quantity > 0;
CREATE INDEX idx_portfolios_user_date ON portfolios(user_id, created_at DESC);

-- Order/Trade Indexes
CREATE INDEX idx_orders_user_status ON orders(user_id, status);
CREATE INDEX idx_orders_symbol_date ON orders(symbol, created_at DESC);
CREATE INDEX idx_orders_executed ON orders(user_id, executed_at DESC) 
  WHERE status = 'EXECUTED';

-- Market Data Indexes
CREATE INDEX idx_market_history_symbol_time ON market_history(symbol, time DESC);
CREATE INDEX idx_prices_symbol_date ON price_history(symbol, date DESC);

-- Risk Management Indexes
CREATE INDEX idx_alerts_user_active ON alerts(user_id, status) 
  WHERE status = 'ACTIVE';
CREATE INDEX idx_risk_limits_user ON risk_limits(user_id);
```

### 3.3 Query Optimization with EXPLAIN ANALYZE

**Analysis Template**:
```sql
-- Before optimization
EXPLAIN ANALYZE
SELECT u.id, u.email, COUNT(p.id) as position_count, SUM(p.quantity) as total_quantity
FROM users u
LEFT JOIN positions p ON u.id = p.user_id
WHERE u.created_at > NOW() - INTERVAL '30 days'
GROUP BY u.id;

-- After optimization (with indexes)
CREATE INDEX idx_positions_user_created ON positions(user_id, created_at DESC);

EXPLAIN ANALYZE
SELECT u.id, u.email, 
       (SELECT COUNT(*) FROM positions WHERE user_id = u.id) as position_count,
       (SELECT SUM(quantity) FROM positions WHERE user_id = u.id) as total_quantity
FROM users u
WHERE u.created_at > NOW() - INTERVAL '30 days';
```

**Common Optimization Patterns**:

1. **Reduce N+1 Queries**:
```typescript
// Before (N+1)
const users = await pool.query('SELECT * FROM users LIMIT 10');
for (const user of users.rows) {
  const positions = await pool.query(
    'SELECT * FROM positions WHERE user_id = $1',
    [user.id]
  );
  user.positions = positions.rows;
}

// After (Single query)
const result = await pool.query(`
  SELECT u.*, jsonb_agg(p.*) as positions
  FROM users u
  LEFT JOIN positions p ON u.id = p.user_id
  WHERE u.id IN (SELECT id FROM users LIMIT 10)
  GROUP BY u.id
`);
```

2. **Use Materialized Views for Complex Aggregations**:
```sql
CREATE MATERIALIZED VIEW user_portfolio_summary AS
SELECT 
  u.id as user_id,
  COUNT(p.id) as position_count,
  SUM(p.quantity * p.avg_price) as total_value,
  MAX(p.updated_at) as last_update
FROM users u
LEFT JOIN positions p ON u.id = p.user_id
GROUP BY u.id;

-- Refresh every 10 minutes
REFRESH MATERIALIZED VIEW CONCURRENTLY user_portfolio_summary;
```

3. **Use LIMIT with Indexes**:
```sql
-- Fast (uses index)
SELECT * FROM orders 
WHERE user_id = $1 
ORDER BY created_at DESC 
LIMIT 10;

-- Slow (full scan)
SELECT * FROM orders 
WHERE user_id = $1 AND status IN ('PENDING', 'EXECUTED')
LIMIT 10;
```

---

## WEEK 3: Response Optimization & CDN

### 4.1 Gzip Compression

**Express Middleware**:
```typescript
import compression from 'compression';

// Add compression to all responses
app.use(compression({
  threshold: 1024,        // Only compress responses > 1KB
  level: 6,               // 1-9 compression level
  filter: (req, res) => {
    // Don't compress certain content types
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));
```

**Expected Compression Ratios**:
- JSON API responses: 60-80% reduction
- HTML pages: 70-85% reduction
- JavaScript: 70-80% reduction
- Images: 5-15% reduction (already compressed)

**Performance Impact**:
- Network bandwidth: 75-80% savings
- Response time: 10-50ms reduction
- CPU overhead: 5-10ms per request

### 4.2 CDN Integration (CloudFlare)

**CloudFlare Setup**:

1. **Add DNS Records**:
```
Type   | Name            | Content             | TTL    | Proxy
------|-----------------|---------------------|--------|-------
CNAME  | api.tradepro.com| gateway.tradepro.com| Auto   | Proxied
CNAME  | www.tradepro.com| web.tradepro.com    | Auto   | Proxied
```

2. **Configure Caching Rules**:
```javascript
// CloudFlare Worker Script
export default {
  async fetch(request) {
    // Cache static assets for 1 month
    if (request.url.includes('/static/')) {
      const response = await fetch(request);
      const newHeaders = new Headers(response.headers);
      newHeaders.set('Cache-Control', 'public, max-age=2592000');
      return new Response(response.body, { ...response, headers: newHeaders });
    }
    
    // Cache API responses for 5 minutes
    if (request.url.includes('/api/v1/market/')) {
      const response = await fetch(request);
      const newHeaders = new Headers(response.headers);
      newHeaders.set('Cache-Control', 'public, max-age=300');
      return new Response(response.body, { ...response, headers: newHeaders });
    }
    
    // Don't cache user-specific data
    if (request.url.includes('/api/v1/users/')) {
      return fetch(request);
    }
  }
};
```

3. **Cache Headers**:
```bash
# Static assets - cache for 1 month
Cache-Control: public, max-age=2592000, immutable

# Market data - cache for 5 minutes
Cache-Control: public, max-age=300

# User data - don't cache
Cache-Control: private, no-cache, no-store

# API responses - cache for 1 minute
Cache-Control: public, max-age=60, must-revalidate
```

### 4.3 Performance Monitoring

**Key Metrics to Monitor**:

1. **Response Time**:
   - P50, P95, P99 response times
   - Target: P95 < 50ms (from 100ms)

2. **Cache Performance**:
   - Cache hit rate (target: >85%)
   - Cache miss rate
   - Cache eviction rate

3. **Database Performance**:
   - Query response times
   - Connection pool utilization
   - Slow query logs

4. **CDN Performance**:
   - Cache hit ratio
   - Origin bandwidth vs CDN bandwidth
   - Miss ratio

**Monitoring Stack**:
```yaml
# Prometheus metrics
prometheus:
  image: prom/prometheus
  volumes:
    - ./prometheus.yml:/etc/prometheus/prometheus.yml
  ports:
    - "9090:9090"

# Grafana dashboards
grafana:
  image: grafana/grafana
  ports:
    - "3000:3000"
  environment:
    - GF_SECURITY_ADMIN_PASSWORD=admin

# Application metrics
# Add to each service:
# - Response time P95, P99
# - Cache hit/miss ratio
# - DB query performance
# - HTTP error rates
```

---

## Deployment Checklist

### Week 1: Redis & Caching
- [ ] Setup Redis infrastructure (single/replica/sentinel)
- [ ] Configure environment variables
- [ ] Implement User service caching
- [ ] Implement Portfolio service caching
- [ ] Implement Market Data service caching
- [ ] Implement Risk Management service caching
- [ ] Setup Kafka cache invalidation
- [ ] Test cache hit rates
- [ ] Validate data consistency

### Week 2: Query Optimization
- [ ] Create new database indexes
- [ ] Run EXPLAIN ANALYZE on critical queries
- [ ] Fix N+1 query problems
- [ ] Setup connection pooling
- [ ] Create materialized views if needed
- [ ] Run performance tests
- [ ] Validate query response times

### Week 3: Response Optimization
- [ ] Enable gzip compression
- [ ] Setup CloudFlare CDN
- [ ] Configure cache headers
- [ ] Setup performance monitoring
- [ ] Run load tests
- [ ] Validate bandwidth reduction
- [ ] Document final performance metrics

---

## Performance Targets & Validation

### Success Criteria

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| API P95 Response | 100ms | <50ms | 🔄 |
| Cache Hit Rate | N/A | >85% | 🔄 |
| DB Load | 100% | 30% | 🔄 |
| Bandwidth | 100% | 20% | 🔄 |
| CDN Cache Hit | N/A | >90% | 🔄 |

### Load Testing
```bash
# Using Apache Bench
ab -n 10000 -c 100 http://localhost:3000/api/v1/market/stocks/AAPL

# Using k6
k6 run performance-test.js --vus 50 --duration 5m
```

---

## Troubleshooting

### Cache Issues
```bash
# Check Redis connection
redis-cli ping

# Monitor cache hits/misses
redis-cli INFO stats

# Clear all cache (careful!)
redis-cli FLUSHDB

# Check memory usage
redis-cli INFO memory
```

### Query Performance
```sql
-- Find slow queries
SELECT query, calls, total_time / calls as avg_time
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 10;

-- Check index usage
SELECT * FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

### CDN Issues
```bash
# Verify cache headers
curl -I https://api.tradepro.com/api/v1/market/stocks/AAPL
# Should show: Cache-Control: public, max-age=300

# Check CDN cache status
curl -I https://api.tradepro.com/api/v1/market/stocks/AAPL | grep CF-Cache-Status
# Should show: CF-Cache-Status: HIT
```

---

## Next Phase: Phase 7 - Disaster Recovery & Business Continuity

Expected timeline: 20-24 hours
- Database backup & recovery
- Service failover mechanisms
- Incident response procedures
- Business continuity planning
