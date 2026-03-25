# Phase 6 Implementation Checklist - Detailed

## Executive Summary
- **Total Duration**: 100-120 hours over 3 weeks
- **Target Outcome**: API P95 <50ms (50% improvement from 100ms)
- **Cache Hit Rate**: >85%
- **DB Load Reduction**: 70%
- **Bandwidth Reduction**: 80%

---

## WEEK 1: Redis Caching Infrastructure (40-50 hours)

### Part 1: Redis Infrastructure Setup (8 hours)
**Day 1-2: Environment & Configuration**

```bash
# 1. Docker Compose Setup
docker-compose up -d redis
docker-compose exec redis redis-cli ping
# Expected: PONG

# 2. Verify Configuration
docker-compose exec redis redis-cli INFO
docker-compose exec redis redis-cli INFO memory
docker-compose exec redis redis-cli CONFIG GET maxmemory
```

**Tasks**:
- [x] Install Redis locally or via Docker ✅
- [ ] Configure redis.conf for production settings
- [ ] Setup environment variables (.env)
- [ ] Create Redis health check endpoints
- [ ] Document Redis setup procedure

**Environment Variables to Add** (.env):
```bash
REDIS_URL=redis://localhost:6379
REDIS_DEFAULT_TTL=3600
REDIS_KEY_PREFIX=local:
REDIS_POOL_SIZE=10
REDIS_POOL_TIMEOUT=5000
CACHE_INVALIDATION_ENABLED=true
REDIS_SENTINEL_ENABLED=false  # Enable for production
```

### Part 2: User Service Caching (10 hours)
**Day 3-4: Implement Cache-Aside Pattern**

**Files Modified**:
- `services/user-service/src/index.ts` ✅ DONE

**Endpoints to Cache**:
- `GET /api/v1/users/:userId` - Profile (TTL: 1 hour)
- `GET /api/v1/users/:userId/settings` - Settings (TTL: 4 hours)
- `GET /api/v1/users/:userId/preferences` - Preferences (TTL: 4 hours)

**Implementation Checklist**:
- [x] Create CacheService class ✅
- [x] Integrate cache into user endpoints ✅
- [ ] Add cache hit/miss metrics
- [ ] Test cache invalidation on updates
- [ ] Verify response time improvement (should be <5ms on cache hit)
- [ ] Load test with 100 concurrent users

**Expected Performance**:
- Cache HIT: <5ms (vs 50-100ms DB)
- Hit Rate: >90% for user profiles

### Part 3: Portfolio Service Caching (12 hours)
**Day 5-6: Cache Portfolio Data**

**Files Created/Modified**:
- `services/portfolio-service/src/PortfolioCacheManager.ts` ✅ DONE
- `services/portfolio-service/src/index.ts` - Integration needed

**Caching Strategy**:
- Portfolio Summary: 5 min TTL (balance, positions count, total value)
- Positions: 5 min TTL (detailed position list)
- P&L: 1 min TTL (most volatile - only 60 sec cache)
- Daily Summary: 24h TTL (stable historical data)

**Implementation Steps**:
```typescript
// 1. Import PortfolioCacheManager
import PortfolioCacheManager from './PortfolioCacheManager';

// 2. Initialize in app startup
const portfolioManager = new PortfolioCacheManager(pool, kafka);
await portfolioManager.initialize();

// 3. Use in endpoints
app.get('/api/v1/portfolio/:userId', async (req, res) => {
  const summary = await portfolioManager.getPortfolioSummary(req.params.userId);
  res.json(summary);
});

// 4. Invalidate on changes
app.post('/api/v1/trades/execute', async (req, res) => {
  // Execute trade...
  await portfolioManager.onTradeExecuted(userId, symbol, side, qty, price);
  res.json({ message: 'Trade executed' });
});
```

**Tasks**:
- [x] Create PortfolioCacheManager ✅
- [ ] Integrate into portfolio-service index.ts
- [ ] Add cache monitoring endpoint
- [ ] Test portfolio summary caching
- [ ] Test positions caching
- [ ] Test P&L caching
- [ ] Verify portfolio data consistency
- [ ] Load test with 50 concurrent portfolios

**Expected Performance**:
- Summary: 30-50ms (uncached) → 5-10ms (cached)
- Positions: 40-60ms → 5-10ms
- P&L: 50-100ms → 5-10ms

### Part 4: Market Data Service Caching (8 hours)
**Day 7: Cache Market Data**

**Caching Strategy**:
- Stock Prices: 10 sec TTL (high volatility, real-time updates)
- Daily Summary: 24h TTL
- Historical Data: 7 day TTL
- Watchlist: 1h TTL

**Implementation Template**:
```typescript
// File: services/market-data-service/src/MarketCacheManager.ts
import CacheService from '../../../packages/shared-types/src/CacheService';

export class MarketCacheManager {
  private cache: CacheService;

  async getPriceData(symbol: string) {
    const cacheKey = `price:${symbol}`;
    
    // Try cache first
    let data = await this.cache.get(cacheKey);
    if (!data) {
      // Fetch from API or market data provider
      data = await this.fetchMarketData(symbol);
      // 10 second TTL for prices
      await this.cache.set(cacheKey, data, 10);
    }
    
    return data;
  }

  async broadcastPriceUpdates() {
    setInterval(async () => {
      for (const symbol of TRACKED_SYMBOLS) {
        const price = await this.fetchLatestPrice(symbol);
        
        // Update cache
        await this.cache.set(`price:${symbol}`, price, 10);
        
        // Broadcast to Kafka for subscribers
        await this.kafka.producer.send({
          topic: 'price_updates',
          messages: [{
            value: JSON.stringify({
              symbol,
              price,
              timestamp: new Date()
            })
          }]
        });
      }
    }, 5000); // Every 5 seconds
  }
}
```

**Tasks**:
- [ ] Create MarketCacheManager
- [ ] Implement price caching
- [ ] Implement daily summary caching
- [ ] Setup price broadcast with Redis updates
- [ ] Test price update frequency
- [ ] Verify cache hit rate >90%

**Expected Performance**:
- Price data: <5ms (cached) vs 50-100ms (API)
- Historical data: <10ms (cached) vs 100-200ms (DB)

### Part 5: Risk Management Service Caching (8 hours)
**Day 8: Cache Risk Settings & Positions**

**Caching Strategy**:
- Risk Settings: 4h TTL
- Active Positions: 1 min TTL (real-time risk)
- Price Cache: 10 sec TTL
- Alerts: 1 min TTL

**Implementation Template**:
```typescript
// File: services/risk-management-service/src/RiskCacheManager.ts
export class RiskCacheManager {
  async getRiskSettings(userId: string) {
    const cacheKey = `risk:${userId}:settings`;
    
    let settings = await this.cache.get(cacheKey);
    if (!settings) {
      settings = await this.pool.query(
        'SELECT * FROM risk_settings WHERE user_id = $1',
        [userId]
      );
      // 4 hour cache for settings
      await this.cache.set(cacheKey, settings, 14400);
    }
    
    return settings;
  }

  async cacheUserPositions(userId: string) {
    const positions = await this.pool.query(
      'SELECT * FROM positions WHERE user_id = $1 AND quantity > 0',
      [userId]
    );
    
    // 1 minute cache for positions (real-time risk checks)
    await this.cache.set(
      `risk:${userId}:positions`,
      positions.rows,
      60
    );
  }

  async checkRisk(symbol: string, price: number) {
    // Get price from cache
    const priceKey = `market:${symbol}:price`;
    await this.cache.set(priceKey, { symbol, price }, 10);
    
    // Check all affected users
    const holders = await this.pool.query(
      'SELECT DISTINCT user_id FROM positions WHERE symbol = $1',
      [symbol]
    );
    
    for (const user of holders.rows) {
      // Get cached risk settings
      const settings = await this.getRiskSettings(user.user_id);
      // Evaluate stop-loss, take-profit, etc.
      this.evaluateRisk(user.user_id, symbol, price, settings);
    }
  }
}
```

**Tasks**:
- [ ] Create RiskCacheManager
- [ ] Implement risk settings caching
- [ ] Implement positions caching for risk
- [ ] Implement price caching for risk checks
- [ ] Setup risk evaluation with cached data
- [ ] Test risk alerts performance

**Expected Performance**:
- Risk check: 5-10ms (all data cached) vs 100-200ms

### Part 6: Kafka Cache Invalidation (12 hours)
**Days 9-10: Event-Based Cache Invalidation**

**Topics to Consume**:
1. `user_updated` - User profile/settings changed
2. `portfolio_changed` - Portfolio balance updated
3. `trade_executed` - Trade completed
4. `price_updated` - Market price changed
5. `settings_changed` - User settings changed

**Implementation Template**:
```typescript
// File: services/shared-utils/src/CacheInvalidationListener.ts
import { Kafka } from 'kafkajs';
import { CacheService } from './CacheService';

export class CacheInvalidationListener {
  private consumer: any;

  async start() {
    this.consumer = this.kafka.consumer({ groupId: 'cache-invalidator' });
    await this.consumer.connect();
    await this.consumer.subscribe({
      topics: [
        'user_updated',
        'portfolio_changed',
        'trade_executed',
        'price_updated',
        'settings_changed'
      ]
    });

    await this.consumer.run({
      eachMessage: async ({ topic, message }) => {
        const data = JSON.parse(message.value?.toString() || '{}');

        switch (topic) {
          case 'user_updated':
            // Invalidate user cache
            await this.cache.deletePattern(`user:${data.userId}:*`);
            break;

          case 'portfolio_changed':
            // Invalidate portfolio cache
            await this.cache.deletePattern(`portfolio:${data.userId}:*`);
            break;

          case 'trade_executed':
            // Invalidate affected caches
            await this.cache.deletePattern(`portfolio:${data.userId}:*`);
            await this.cache.deletePattern(`risk:${data.userId}:*`);
            
            // Also invalidate other users with this symbol
            await this.invalidateSymbolHolders(data.symbol);
            break;

          case 'price_updated':
            // Invalidate portfolio for all users with this symbol
            await this.invalidateSymbolHolders(data.symbol);
            break;

          case 'settings_changed':
            // Invalidate settings cache
            await this.cache.deletePattern(`user:${data.userId}:settings`);
            break;
        }

        console.log(`📨 Cache invalidation processed: ${topic}`);
      }
    });
  }

  private async invalidateSymbolHolders(symbol: string) {
    const holders = await this.pool.query(
      'SELECT DISTINCT user_id FROM positions WHERE symbol = $1',
      [symbol]
    );

    for (const user of holders.rows) {
      await this.cache.deletePattern(`portfolio:${user.user_id}:*`);
    }
  }
}
```

**Integration Steps**:
```typescript
// In each service's index.ts
import { CacheInvalidationListener } from '../../../packages/shared-utils/src/CacheInvalidationListener';

const cacheListener = new CacheInvalidationListener(cache, pool, kafka);
await cacheListener.start();
```

**Tasks**:
- [ ] Create CacheInvalidationListener
- [ ] Setup consumer for user_updated topic
- [ ] Setup consumer for portfolio_changed topic
- [ ] Setup consumer for trade_executed topic
- [ ] Setup consumer for price_updated topic
- [ ] Setup consumer for settings_changed topic
- [ ] Test invalidation flow end-to-end
- [ ] Verify cache consistency after invalidation

**Expected Performance**:
- Invalidation latency: <100ms
- Cache consistency: 100%

**Week 1 Validation**:
- [ ] Cache hit rate for user data: >90%
- [ ] Cache hit rate for portfolio: >80%
- [ ] Cache hit rate for market data: >95%
- [ ] API response time with cache: <20ms
- [ ] Kafka invalidation events: <100ms delay
- [ ] No data inconsistency issues

---

## WEEK 2: Query Optimization & Connection Pooling (30-40 hours)

### Part 1: Connection Pooling Setup (8 hours)

**Current Configuration** (per service):
```typescript
const pool = new Pool({
  max: 10,
  min: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});
```

**Optimized Configuration**:
```typescript
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  
  // Connection pool settings
  max: 20,                    // Max connections
  min: 5,                     // Min connections  
  idleTimeoutMillis: 30000,   // Close after 30 sec idle
  connectionTimeoutMillis: 2000, // 2sec timeout
  
  // Application name for monitoring
  application_name: 'user-service',
  
  // SSL for production
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false
});

// Monitor pool health
setInterval(() => {
  console.log(`Pool: ${pool.totalCount} total, ${pool.idleCount} idle`);
}, 60000);
```

**Database Configuration** (`postgresql.conf`):
```sql
-- Connection settings
max_connections = 200
superuser_reserved_connections = 3

-- Performance tuning
shared_buffers = '4GB'
effective_cache_size = '12GB'
maintenance_work_mem = '1GB'
checkpoint_completion_target = 0.9
wal_buffers = '16MB'
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = '10485kB'

-- Monitoring
log_connections = on
log_disconnections = on
log_min_duration_statement = 5000  # Log queries > 5 seconds
```

**Tasks**:
- [ ] Update all service pool configurations
- [ ] Set proper min/max pool sizes
- [ ] Configure connection timeouts
- [ ] Setup pool health monitoring
- [ ] Add pool metrics logging
- [ ] Load test with concurrent connections

### Part 2: Query Optimization (10 hours)

**Identify Slow Queries**:
```sql
-- Enable query logging
ALTER SYSTEM SET log_min_duration_statement = 5000;
SELECT pg_reload_conf();

-- Find slow queries
SELECT * FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 20;

-- Analyze specific query
EXPLAIN ANALYZE
SELECT u.id, u.email, COUNT(p.id) as positions
FROM users u
LEFT JOIN positions p ON u.id = p.user_id
WHERE u.created_at > NOW() - INTERVAL '30 days'
GROUP BY u.id;
```

**Optimization Patterns**:

1. **Remove N+1 Queries**:
```sql
-- BEFORE (N+1 problem)
-- 1 query to get users + N queries to get their positions

-- AFTER (single query)
SELECT 
  u.id,
  u.email,
  jsonb_agg(p.*) as positions
FROM users u
LEFT JOIN positions p ON u.id = p.user_id
WHERE u.created_at > NOW() - INTERVAL '30 days'
GROUP BY u.id;
```

2. **Use Materialized Views for Aggregations**:
```sql
CREATE MATERIALIZED VIEW user_portfolio_stats AS
SELECT 
  u.id as user_id,
  u.email,
  COUNT(DISTINCT p.id) as position_count,
  SUM(p.quantity * p.avg_price) as total_value,
  MAX(p.updated_at) as last_update
FROM users u
LEFT JOIN positions p ON u.id = p.user_id
WHERE u.active = true
GROUP BY u.id, u.email;

-- Refresh every 10 minutes
CREATE OR REPLACE FUNCTION refresh_portfolio_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_portfolio_stats;
END;
$$ LANGUAGE plpgsql;

-- Schedule with pg_cron
SELECT cron.schedule('refresh-portfolio-stats', '*/10 * * * *', 'SELECT refresh_portfolio_stats();');
```

3. **Optimize JOIN Operations**:
```sql
-- BEFORE (slow join)
SELECT o.id, o.symbol, p.avg_price
FROM orders o
LEFT JOIN positions p ON o.user_id = p.user_id AND o.symbol = p.symbol;

-- AFTER (optimized with subquery)
SELECT o.id, o.symbol, 
  (SELECT avg_price FROM positions p 
   WHERE p.user_id = o.user_id AND p.symbol = o.symbol 
   LIMIT 1) as avg_price
FROM orders o;
```

**Tasks**:
- [ ] Query analysis with EXPLAIN ANALYZE
- [ ] Identify N+1 problem areas
- [ ] Replace with optimized queries
- [ ] Create materialized views for complex aggregations
- [ ] Update ORM queries if applicable
- [ ] Benchmark query improvements

### Part 3: Database Indexes (12 hours)

**Create Missing Indexes**:
```sql
-- User Service Indexes
CREATE INDEX idx_users_email ON users(email) WHERE active = true;
CREATE INDEX idx_users_created_at ON users(created_at DESC);
CREATE INDEX idx_users_status_active ON users(status, active);

-- Portfolio Service Indexes
CREATE INDEX idx_positions_user_symbol ON positions(user_id, symbol);
CREATE INDEX idx_positions_user_quantity ON positions(user_id) WHERE quantity > 0;
CREATE INDEX idx_portfolios_user_currency ON portfolios(user_id, currency);
CREATE INDEX idx_portfolio_history_user_date ON portfolio_history(user_id, created_at DESC);

-- Orders/Trading Indexes
CREATE INDEX idx_orders_user_status ON orders(user_id, status);
CREATE INDEX idx_orders_symbol_date ON orders(symbol, created_at DESC);
CREATE INDEX idx_orders_executed ON orders(user_id, executed_at DESC) WHERE status = 'EXECUTED';
CREATE INDEX idx_orders_user_symbol_type ON orders(user_id, symbol, type);

-- Market Data Indexes
CREATE INDEX idx_market_history_symbol_time ON market_history(symbol, time DESC);
CREATE INDEX idx_price_history_symbol_date ON price_history(symbol, date DESC);
CREATE INDEX idx_market_symbol_bid_ask ON market_quotes(symbol, bid DESC, ask ASC);

-- Risk Management Indexes
CREATE INDEX idx_alerts_user_active ON alerts(user_id, status) WHERE status = 'ACTIVE';
CREATE INDEX idx_risk_limits_user ON risk_limits(user_id);
CREATE INDEX idx_positions_quantity ON positions(user_id, quantity) WHERE quantity > 0;
```

**Index Analysis**:
```sql
-- Check index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Find unused indexes
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;
```

**Tasks**:
- [ ] Create 5-10 new indexes
- [ ] Verify index usage
- [ ] Remove unused indexes
- [ ] Measure query performance improvement
- [ ] Document index strategy
- [ ] Set up index monitoring

**Expected Index Impact**:
- Index scan: 50-100x faster for indexed columns
- Overall DB load reduction: 40-50%

### Part 4: Performance Testing (10 hours)

**Load Testing Tool Setup**:
```bash
# Using k6
npm install -g k6

# Create performance test
cat > performance-test.js << 'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  vus: 50,        // 50 virtual users
  duration: '5m'  // 5 minutes
};

export default function() {
  // Test user endpoint
  let userRes = http.get('http://localhost:3000/api/v1/users/123');
  check(userRes, {
    'user status is 200': (r) => r.status === 200,
    'user response time < 50ms': (r) => r.timings.duration < 50,
  });

  // Test portfolio endpoint
  let portfolioRes = http.get('http://localhost:3000/api/v1/portfolio/123');
  check(portfolioRes, {
    'portfolio status is 200': (r) => r.status === 200,
    'portfolio response time < 50ms': (r) => r.timings.duration < 50,
  });

  sleep(1);
}
EOF

# Run test
k6 run performance-test.js
```

**Benchmarking Results**:
Track before/after metrics:
- [ ] Response time P50, P95, P99
- [ ] Query execution time
- [ ] Index scan performance
- [ ] Connection pool utilization

**Week 2 Validation**:
- [ ] All critical queries < 50ms
- [ ] N+1 problems fixed
- [ ] New indexes created and verified
- [ ] Connection pool optimized
- [ ] Query performance improved 30-50%

---

## WEEK 3: Response Optimization & CDN (30-40 hours)

### Part 1: Gzip Compression (8 hours)

**Install compression middleware**:
```typescript
npm install compression

// Add to each service
import compression from 'compression';

const app = express();

// Apply compression to all responses
app.use(compression({
  threshold: 1024,        // Only compress > 1KB
  level: 6,               // Compression level 1-9
  filter: (req, res) => {
    // Don't compress certain types
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  chunkSize: 16 * 1024   // 16KB chunks
}));

// Monitor compression
app.use((req, res, next) => {
  res.on('finish', () => {
    const encoding = res.getHeader('content-encoding');
    if (encoding) {
      console.log(`✅ Response compressed with ${encoding}`);
    }
  });
  next();
});
```

**Expected Compression Ratios**:
- JSON API: 60-80% reduction
- HTML pages: 70-85% reduction
- JavaScript: 70-80% reduction

**Tasks**:
- [ ] Install compression in all services
- [ ] Configure compression settings
- [ ] Add compression metrics
- [ ] Test with various content types
- [ ] Measure bandwidth reduction
- [ ] Verify response times with compression

### Part 2: CDN Integration (12 hours)

**CloudFlare Setup**:

1. **Add DNS Records**:
```
api.tradepro.com CNAME gateway.tradepro.com
www.tradepro.com CNAME web.tradepro.com
```

2. **Configure Caching Rules**:
```javascript
// CloudFlare Worker
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // Cache static assets for 30 days
  if (request.url.includes('/static/')) {
    const response = await fetch(request)
    const newHeaders = new Headers(response.headers)
    newHeaders.set('Cache-Control', 'public, max-age=2592000, immutable')
    return new Response(response.body, { ...response, headers: newHeaders })
  }

  // Cache API for 5 minutes
  if (request.url.includes('/api/v1/market/')) {
    const response = await fetch(request)
    const newHeaders = new Headers(response.headers)
    newHeaders.set('Cache-Control', 'public, max-age=300')
    return new Response(response.body, { ...response, headers: newHeaders })
  }

  // Don't cache user-specific data
  if (request.url.includes('/api/v1/users/')) {
    const response = await fetch(request)
    const newHeaders = new Headers(response.headers)
    newHeaders.set('Cache-Control', 'private, no-cache')
    return new Response(response.body, { ...response, headers: newHeaders })
  }

  return fetch(request)
}
```

3. **Set Cache Headers**:
```typescript
// Middleware for setting cache headers
app.use((req, res, next) => {
  // Static assets
  if (req.path.startsWith('/static/')) {
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
  }
  // Market data (public)
  else if (req.path.includes('/market/')) {
    res.set('Cache-Control', 'public, max-age=300');
  }
  // API responses (public aggregates)
  else if (req.path.includes('/api/v1/public/')) {
    res.set('Cache-Control', 'public, max-age=60');
  }
  // User data (private, don't cache)
  else if (req.path.includes('/api/v1/users/')) {
    res.set('Cache-Control', 'private, no-cache, no-store');
  }
  // Default
  else {
    res.set('Cache-Control', 'private, must-revalidate');
  }

  next();
});
```

**Verify CDN Setup**:
```bash
# Check cache headers
curl -I https://api.tradepro.com/api/v1/market/stocks/AAPL
# Should show: Cache-Control: public, max-age=300

# Check CDN cache status
curl -I https://api.tradepro.com/api/v1/market/stocks/AAPL | grep CF-Cache-Status
# Should show: CF-Cache-Status: HIT (after first request)

# Clear CDN cache
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache" \
  -H "X-Auth-Email: email@example.com" \
  -H "X-Auth-Key: api_key" \
  -H "Content-Type: application/json" \
  --data '{"files":["https://api.tradepro.com/api/v1/market/stocks/AAPL"]}'
```

**Tasks**:
- [ ] Setup CloudFlare account
- [ ] Add DNS records
- [ ] Create CDN cache rules
- [ ] Setup cache headers in services
- [ ] Configure cache purging strategy
- [ ] Monitor CDN cache hits
- [ ] Test CDN performance
- [ ] Document CDN process

### Part 3: Performance Monitoring (10 hours)

**Setup Prometheus + Grafana**:
```yaml
# docker-compose addition
prometheus:
  image: prom/prometheus
  ports:
    - "9090:9090"
  volumes:
    - ./prometheus.yml:/etc/prometheus/prometheus.yml
    - prometheus_data:/prometheus

grafana:
  image: grafana/grafana
  ports:
    - "3001:3000"
  environment:
    - GF_SECURITY_ADMIN_PASSWORD=admin
  volumes:
    - grafana_data:/var/lib/grafana
```

**Prometheus Configuration** (`prometheus.yml`):
```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'user-service'
    static_configs:
      - targets: ['localhost:3002/metrics']

  - job_name: 'portfolio-service'
    static_configs:
      - targets: ['localhost:3003/metrics']

  - job_name: 'market-data-service'
    static_configs:
      - targets: ['localhost:3004/metrics']

  - job_name: 'redis'
    static_configs:
      - targets: ['localhost:6379']
```

**Add Metrics to Services**:
```typescript
import client from 'prom-client';

// Response time histogram
const httpHistogram = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2],
});

// Cache hit/miss counter
const cacheCounter = new client.Counter({
  name: 'cache_operations_total',
  help: 'Total cache operations',
  labelNames: ['operation', 'status'],
});

// Middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpHistogram.labels(req.method, req.route, res.statusCode).observe(duration);
  });
  next();
});

// Expose metrics
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});
```

**Grafana Dashboards to Create**:
1. API Performance Dashboard
   - P50, P95, P99 response times
   - Request rate (req/sec)
   - Error rate %

2. Cache Performance Dashboard
   - Hit rate %
   - Miss rate %
   - Eviction rate
   - Memory usage

3. Database Dashboard
   - Query execution time
   - Connection pool status
   - Slow queries

4. CDN Dashboard
   - Cache hit ratio
   - Origin vs CDN bandwidth
   - Miss ratio

**Tasks**:
- [ ] Setup Prometheus
- [ ] Setup Grafana
- [ ] Add Prometheus client to services
- [ ] Create response time metrics
- [ ] Create cache metrics
- [ ] Create database metrics
- [ ] Create dashboards
- [ ] Setup alerting rules

### Part 4: End-to-End Testing (10 hours)

**Test Suite**:
```typescript
// tests/performance.test.ts
import axios from 'axios';

describe('Phase 6 Performance Tests', () => {
  
  it('User profile endpoint P95 < 50ms', async () => {
    const times: number[] = [];
    
    for (let i = 0; i < 100; i++) {
      const start = Date.now();
      await axios.get('http://localhost:3000/api/v1/users/123');
      times.push(Date.now() - start);
    }
    
    times.sort((a, b) => a - b);
    const p95 = times[Math.floor(95)];
    
    expect(p95).toBeLessThan(50);
  });

  it('Cache hit rate > 85%', async () => {
    let hits = 0;
    let misses = 0;
    
    for (let i = 0; i < 100; i++) {
      const response = await axios.get('http://localhost:3000/api/v1/users/123');
      if (response.data._cached) {
        hits++;
      } else {
        misses++;
      }
    }
    
    const hitRate = hits / (hits + misses);
    expect(hitRate).toBeGreaterThan(0.85);
  });

  it('Database load reduced by 70%', async () => {
    // Measure DB connections before caching
    // Measure DB connections after caching
    // Verify 70% reduction
  });

  it('Bandwidth reduced by 80%', async () => {
    // Measure response size without compression
    // Measure response size with compression
    // Verify 80% reduction
  });

  it('CDN cache hits > 90%', async () => {
    // Make requests through CDN
    // Check CF-Cache-Status header
    // Verify >90% hits
  });
});
```

**Load Testing**:
```bash
# Run load test
k6 run performance-test.js --vus 100 --duration 10m

# Expected results:
# - Average response time: <30ms
# - P95 response time: <50ms
# - Error rate: <0.1%
# - Cache hit rate: >85%
```

**Tasks**:
- [ ] Create performance test suite
- [ ] Run load tests
- [ ] Verify P95 < 50ms
- [ ] Verify cache hit rate >85%
- [ ] Verify DB load reduction
- [ ] Verify bandwidth reduction
- [ ] Document test results

---

## Phase 6 Final Validation

### Success Criteria Checklist

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| API P95 | <50ms | 100ms | 🔄 |
| Cache Hit Rate | >85% | N/A | 🔄 |
| DB Load | -70% | 100% | 🔄 |
| Bandwidth | -80% | 100% | 🔄 |
| CDN Cache Hit | >90% | N/A | 🔄 |

### Sign-Off
- [ ] All tests passing
- [ ] Performance metrics documented
- [ ] Monitoring dashboards active
- [ ] Documentation complete
- [ ] Team trained on new systems

---

## Troubleshooting Guide

### Redis Issues
```bash
redis-cli ping               # Test connection
redis-cli INFO stats         # Check memory/stats
redis-cli FLUSHDB           # Clear cache if needed
redis-cli MONITOR           # Watch key changes
```

### Database Issues
```sql
-- Slow queries
SELECT * FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;

-- Index status
SELECT * FROM pg_stat_user_indexes ORDER BY idx_scan DESC;

-- Connection info
SELECT count(*) FROM pg_stat_activity;
```

### CDN Issues
```bash
# Verify headers
curl -I https://api.tradepro.com/api/v1/market/AAPL

# Check cache status
curl -I https://api.tradepro.com/api/v1/market/AAPL | grep CF-

# Purge cache
curl -X POST https://api.cloudflare.com/client/v4/zones/123/purge_cache \
  -H "X-Auth-Email: your@email.com" \
  -H "X-Auth-Key: your-api-key" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'
```

---

## Next Phase: Phase 7 - Disaster Recovery & Business Continuity (20-24 hours)
- Database backup & recovery automation
- Service failover mechanisms
- Incident response procedures
- RTO/RPO targets
