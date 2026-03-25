# Phase 6: Implementation Checklist & Quick Reference

## Quick Start: Redis Setup (5 minutes)

### Option 1: Docker Compose (Recommended)
```bash
cd c:\Users\r\Desktop\stock market agent

# Add to docker-compose.yml if not present
cat >> docker-compose.yml << 'EOF'
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - trading_network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  redis_data:

networks:
  trading_network:
EOF

# Start Redis
docker-compose up -d redis

# Verify connection
docker-compose exec redis redis-cli ping
# Should return: PONG
```

### Option 2: Local Installation
```bash
# Windows (using choco or manual)
choco install redis-64

# Mac
brew install redis

# Start service
redis-server
```

---

## Phase 6 Week 1: 40-50 Hours

### Daily Breakdown

#### Day 1-2: Core Infrastructure (8 hours)
**Redis Setup & Configuration**

```bash
# 1. Create redis.conf for production
mkdir -p infra/redis
cat > infra/redis/redis.conf << 'EOF'
port 6379
protected-mode yes
databases 16
save 900 1
save 300 10
save 60 10000
rdbcompression yes
rdbchecksum yes
appendonly yes
appendfsync everysec
loglevel notice
maxmemory 2gb
maxmemory-policy allkeys-lru
EOF

# 2. Test connection
redis-cli ping
# Output: PONG

# 3. Check stats
redis-cli INFO stats
redis-cli INFO memory
```

**Todos**:
- [ ] Setup Redis locally
- [ ] Configure redis.conf
- [ ] Test connection
- [ ] Create Docker setup
- [ ] Document environment variables

#### Day 3-4: User Service Caching (10 hours)
**File**: `services/user-service/src`

**Tasks**:
1. Create cache service class
2. Integrate with GET /users/:userId
3. Integrate with POST /users (cache invalidation)
4. Add cache hit metrics
5. Test with 100 requests

**Code Template**:
```typescript
// services/user-service/src/cache.ts
import { createClient } from 'redis';

export class CacheService {
  private redis = createClient({ url: process.env.REDIS_URL });
  private readonly DEFAULT_TTL = 3600;

  async get(key: string) {
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async set(key: string, value: any, ttl = this.DEFAULT_TTL) {
    await this.redis.setEx(key, ttl, JSON.stringify(value));
  }

  async delete(key: string) {
    await this.redis.del(key);
  }

  async deletePattern(pattern: string) {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(keys);
    }
  }
}

// In index.ts or routes
const cache = new CacheService();

app.get('/api/v1/users/:userId', async (req, res) => {
  const { userId } = req.params;
  
  // Try cache first
  const cached = await cache.get(`user:${userId}`);
  if (cached) {
    return res.status(200).json({
      ...cached,
      _cached: true,
      _timestamp: new Date()
    });
  }

  // Query DB
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  const user = result.rows[0];
  
  // Cache result
  await cache.set(`user:${userId}`, user, 3600);

  res.json(user);
});

// Update endpoint
app.post('/api/v1/users/:userId', async (req, res) => {
  const { userId } = req.params;

  // Update in DB
  await pool.query('UPDATE users SET ... WHERE id = $1', [userId]);

  // Invalidate cache
  await cache.delete(`user:${userId}`);
  await cache.delete(`user:${userId}:settings`);

  res.json({ message: 'User updated' });
});
```

**Todos**:
- [ ] Create cache.ts service
- [ ] Update user-service/index.ts
- [ ] Test GET endpoint
- [ ] Test cache invalidation
- [ ] Measure hit rate

#### Day 5-6: Portfolio Service Caching (12 hours)
**File**: `services/portfolio-service/src`

**Tasks**:
1. Cache portfolio summary (5min TTL)
2. Cache positions (5min TTL)
3. Cache P&L calculations (1min TTL)
4. Integrate with existing index.ts
5. Test portfolio endpoints

**Code Template**:
```typescript
// services/portfolio-service/src/index.ts
const cache = new CacheService();

// Get portfolio summary
app.get('/api/v1/portfolio/:userId/summary', async (req, res) => {
  const { userId } = req.params;
  const cacheKey = `portfolio:${userId}:summary`;

  // Try cache
  let portfolio = await cache.get(cacheKey);
  if (portfolio) {
    return res.json({ ...portfolio, _cached: true });
  }

  // Calculate summary
  const positions = await getPositionsFromDB(userId);
  const cash = await getCashBalance(userId);
  const pnl = calculatePnL(positions);

  portfolio = {
    positions,
    cash,
    pnl,
    totalValue: calculateTotalValue(positions, cash),
    updatedAt: new Date()
  };

  // Cache for 5 minutes
  await cache.set(cacheKey, portfolio, 300);

  res.json(portfolio);
});

// Get all positions
app.get('/api/v1/portfolio/:userId/positions', async (req, res) => {
  const { userId } = req.params;
  const cacheKey = `portfolio:${userId}:positions`;

  let positions = await cache.get(cacheKey);
  if (!positions) {
    positions = await getPositionsFromDB(userId);
    await cache.set(cacheKey, positions, 300);
  }

  res.json(positions);
});

// When portfolio is updated
async function onPortfolioUpdate(userId: string) {
  // Invalidate all related caches
  await cache.deletePattern(`portfolio:${userId}:*`);
}

// When trade executes
async function onTradeExecuted(userId: string, symbol: string) {
  await cache.deletePattern(`portfolio:${userId}:*`);

  // Emit Kafka event for other services
  await producer.send({
    topic: 'cache_invalidation',
    messages: [{
      value: JSON.stringify({
        event: 'PORTFOLIO_CHANGED',
        userId,
        symbol,
        timestamp: new Date()
      })
    }]
  });
}
```

**Todos**:
- [ ] Implement portfolio cache
- [ ] Test summary endpoint
- [ ] Test positions endpoint
- [ ] Test cache invalidation
- [ ] Measure response time improvement

#### Day 7: Market Data Service Caching (8 hours)
**File**: `services/market-data-service/src`

**Tasks**:
1. Cache stock prices (10sec TTL)
2. Cache daily summaries (24h TTL)
3. Cache historical data (7 day TTL)
4. Integrate price broadcasts
5. Test with real market data

**Code Template**:
```typescript
// services/market-data-service/src/index.ts
const cache = new CacheService();

// Get current price
app.get('/api/v1/market/stocks/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const cacheKey = `market:${symbol}`;

  let data = await cache.get(cacheKey);
  if (!data) {
    // Fetch from market API or static data
    data = await fetchMarketData(symbol);
    // Very short TTL (10 seconds) for prices
    await cache.set(cacheKey, data, 10);
  }

  res.json(data);
});

// Get daily summary
app.get('/api/v1/market/daily/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const cacheKey = `market:${symbol}:daily`;

  let data = await cache.get(cacheKey);
  if (!data) {
    data = await pool.query(
      'SELECT * FROM market_daily WHERE symbol = $1',
      [symbol]
    );
    await cache.set(cacheKey, data, 86400); // 24 hours
  }

  res.json(data.rows);
});

// Broadcast new prices
async function broadcastPrices() {
  setInterval(async () => {
    for (const symbol of TRACKED_SYMBOLS) {
      const price = await fetchPrice(symbol);
      
      // Update cache
      await cache.set(`market:${symbol}`, {
        symbol,
        price,
        timestamp: new Date()
      }, 10);

      // Broadcast to Kafka
      await producer.send({
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
```

**Todos**:
- [ ] Implement price caching
- [ ] Implement daily summary cache
- [ ] Implement historical cache
- [ ] Test price broadcast
- [ ] Measure cache efficiency

#### Day 8-10: Risk & Kafka Integration (12 hours)
**Files**: `services/risk-management-service/src`

**Tasks**:
1. Cache risk settings
2. Cache active positions
3. Implement Kafka cache invalidation listener
4. Test cache invalidation flow
5. End-to-end testing

**Code Template**:
```typescript
// services/risk-management-service/src/cache-invalidation.ts
import { Kafka } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'risk-cache-invalidator',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092']
});

const consumer = kafka.consumer({ groupId: 'risk-cache-workers' });

export async function startCacheInvalidationListener() {
  await consumer.connect();
  await consumer.subscribe({
    topics: ['cache_invalidation', 'price_updates', 'trade_executed']
  });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      try {
        const data = JSON.parse(message.value?.toString() || '{}');

        console.log(`📨 Invalidation event: ${topic}`, data);

        switch (topic) {
          case 'price_updates':
            // Invalidate all affected portfolios
            await onPriceUpdate(data.symbol, data.price);
            break;

          case 'trade_executed':
            // Invalidate user's portfolio cache
            await onTradeExecuted(data.userId, data.symbol);
            break;

          case 'cache_invalidation':
            // Generic invalidation
            if (data.event === 'PORTFOLIO_CHANGED') {
              await cache.deletePattern(`portfolio:${data.userId}:*`);
            }
            break;
        }
      } catch (error) {
        console.error('Error processing cache invalidation:', error);
      }
    }
  });
}

async function onPriceUpdate(symbol: string, price: number) {
  // Find all users affected
  const holders = await pool.query(
    'SELECT DISTINCT user_id FROM positions WHERE symbol = $1',
    [symbol]
  );

  for (const user of holders.rows) {
    await cache.deletePattern(`portfolio:${user.user_id}:*`);
    await cache.deletePattern(`risk:${user.user_id}:*`);
  }
}

async function onTradeExecuted(userId: string, symbol: string) {
  await cache.deletePattern(`portfolio:${userId}:*`);
  await cache.deletePattern(`risk:${userId}:*`);
}
```

**Todos**:
- [ ] Implement cache invalidation listener
- [ ] Test Kafka messages
- [ ] Test cache deletion
- [ ] End-to-end test
- [ ] Validate data consistency

---

## Phase 6 Week 2: 30-40 Hours

### Tasks
- [ ] Run EXPLAIN ANALYZE on all critical queries
- [ ] Create new database indexes (5-10)
- [ ] Setup connection pooling
- [ ] Optimize N+1 queries
- [ ] Create materialized views
- [ ] Run performance benchmarks
- [ ] Document query improvements

**Example Indexes** to create:
```sql
CREATE INDEX idx_positions_user_symbol ON positions(user_id, symbol);
CREATE INDEX idx_orders_user_status ON orders(user_id, status);
CREATE INDEX idx_market_history_time ON market_history(symbol, time DESC);
CREATE INDEX idx_alerts_user_active ON alerts(user_id, status) WHERE status = 'ACTIVE';
```

---

## Phase 6 Week 3: 30-40 Hours

### Tasks
- [ ] Enable gzip compression in Express
- [ ] Configure CloudFlare CDN
- [ ] Setup cache headers
- [ ] Create performance monitoring dashboard
- [ ] Run load tests
- [ ] Validate bandwidth reduction
- [ ] Document final metrics

---

## Caching Patterns Quick Reference

### 1. Cache-Aside (Fast reads, eventual consistency)
```typescript
async function getData(key: string) {
  const cached = await cache.get(key);
  if (cached) return cached;
  
  const data = await db.query(...);
  await cache.set(key, data);
  return data;
}
```

### 2. Write-Through (Consistent writes)
```typescript
async function updateData(key: string, value: any) {
  await cache.set(key, value);
  await db.query(...);</p>
  return value;
}
```

### 3. Write-Behind (Batched writes)
```typescript
const buffer = new Map();
buffer.set(key, value);
setInterval(() => {
  for (const [k, v] of buffer) {
    await db.query(...);
  }
  buffer.clear();
}, 10000);
```

### 4. Event-Based Invalidation (Real-time)
```typescript
onTradeExecuted(userId) => {
  await cache.del(`portfolio:${userId}`);
}
```

---

## Performance Monitoring Commands

### Redis Monitoring
```bash
# Real-time stats
redis-cli MONITOR

# Memory usage
redis-cli INFO memory

# Check keys
redis-cli KEYS pattern

# Get cache hit rate
redis-cli INFO stats | grep hits
```

### Database Monitoring
```sql
-- Slow queries
SELECT * FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;

-- Index usage
SELECT * FROM pg_stat_user_indexes ORDER BY idx_scan DESC;

-- Connection count
SELECT count(*) FROM pg_stat_activity;
```

---

## Success Metrics

Target Performance by End of Week 3:
- API P95: <50ms (from 100ms) ✓
- Cache hit rate: >85% ✓
- DB load: 30% (from 100%) ✓
- Bandwidth: 20% (from 100%) ✓
- CDN Hit: >90% ✓

---

## Next: Troubleshooting

### Cache Issues
```bash
# Connection refused
# Solution: Check Redis is running
redis-cli ping

# High memory usage
# Solution: Implement TTL and eviction policy
redis-cli CONFIG GET maxmemory-policy

# Cache misses
# Solution: Verify keys are correct
redis-cli GET user:123
```

### Query Issues
```sql
-- Slow response
-- Solution: Add indexes
CREATE INDEX idx_name ON table(column);

-- Connection errors
-- Solution: Check pool settings
SHOW max_connections;
```

---

## Files Modified This Phase

- `services/user-service/src/` - Added caching
- `services/portfolio-service/src/` - Added caching
- `services/market-data-service/src/` - Added caching
- `services/risk-management-service/src/` - Added caching
- `infra/redis/redis.conf` - New Redis config
- `docker-compose.yml` - Added Redis service
- `docs/PHASE_6_DEPLOYMENT_GUIDE.md` - Comprehensive guide
