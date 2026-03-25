# Phase 6: Quick Start Implementation Guide

## Getting Started (Next 2 Hours)

### Step 1: Verify Redis Setup (10 minutes)

```bash
# Verify Redis is running
docker-compose up -d redis
docker-compose ps

# Test connection
docker-compose exec redis redis-cli ping
# Output: PONG

# Check memory
docker-compose exec redis redis-cli INFO memory
```

✅ **Check**: Redis is accessible and responding

---

### Step 2: Understand the Architecture (20 minutes)

**Read in this order**:
1. `docs/PHASE_6_QUICK_REFERENCE.md` - 5 min overview
2. `docs/PHASE_6_DEPLOYMENT_GUIDE.md` - Section 2.1-2.2 (caching patterns)
3. Code examples in `packages/shared-types/src/CacheService.ts`

**Key concepts**:
- Cache-Aside: Try cache → DB → Cache result
- Write-Through: Write to cache → DB
- Event-Based: Kafka invalidation
- TTL: Time to live (3600, 300, 60, etc.)

---

### Step 3: Add Caching to Your Service (1 hour)

**Template for each service**:

```typescript
// 1. Import CacheService
import CacheService from '../../../packages/shared-types/src/CacheService';

// 2. Initialize in app startup
const cache = new CacheService({
  url: process.env.REDIS_URL,
  defaultTTL: 3600,
  keyPrefix: process.env.REDIS_KEY_PREFIX || 'service-name'
});

// 3. In your main function
app.listen(port, async () => {
  try {
    await cache.connect();
    console.log('✅ Service initialized with cache');
  } catch (error) {
    console.error('❌ Failed to initialize cache:', error);
    process.exit(1);
  }
});

// 4. Add caching to GET endpoints
app.get('/api/v1/endpoint/:id', async (req, res) => {
  const { id } = req.params;
  const startTime = Date.now();

  // Try cache first
  const cached = await cache.get(`endpoint:${id}`);
  if (cached) {
    const responseTime = Date.now() - startTime;
    return res.json({
      ...cached,
      _cached: true,
      _responseTime: `${responseTime}ms`
    });
  }

  // Query database
  const data = await pool.query('SELECT * FROM table WHERE id = $1', [id]);
  if (data.rows.length === 0) {
    return res.status(404).json({ error: 'Not found' });
  }

  // Cache result (TTL in seconds)
  await cache.set(`endpoint:${id}`, data.rows[0], 3600);

  const responseTime = Date.now() - startTime;
  res.json({
    ...data.rows[0],
    _cached: false,
    _responseTime: `${responseTime}ms`
  });
});

// 5. Add cache invalidation to POST/PUT endpoints
app.put('/api/v1/endpoint/:id', async (req, res) => {
  const { id } = req.params;
  
  // Update database
  const result = await pool.query('UPDATE table SET ... WHERE id = $1 RETURNING *', [id]);
  
  // Invalidate cache
  await cache.delete(`endpoint:${id}`);
  await cache.deletePattern(`endpoint:${id}:*`);
  
  res.json({ message: 'Updated', data: result.rows[0] });
});

// 6. Add health check endpoint
app.get('/api/v1/health/cache', (req, res) => {
  const stats = cache.getStats();
  res.json({
    status: cache.isReady() ? 'connected' : 'disconnected',
    stats,
    uptime: process.uptime()
  });
});
```

---

### Service-Specific Implementation

#### User Service
**Already done** ✅

Check: `services/user-service/src/index.ts`

#### Portfolio Service

```bash
# Copy the PortfolioCacheManager into your service
cp services/portfolio-service/src/PortfolioCacheManager.ts services/portfolio-service/src/

# In services/portfolio-service/src/index.ts, add:
import PortfolioCacheManager from './PortfolioCacheManager';

// Initialize
const portfolioManager = new PortfolioCacheManager(pool, kafka);
await portfolioManager.initialize();

// Use in endpoints
app.get('/api/v1/portfolio/:userId', async (req, res) => {
  const summary = await portfolioManager.getPortfolioSummary(req.params.userId);
  res.json(summary);
});

// Invalidate on trade
app.post('/api/v1/trades', async (req, res) => {
  const { userId, symbol, side, quantity, price } = req.body;
  
  // Execute trade...
  
  // Invalidate cache
  await portfolioManager.onTradeExecuted(userId, symbol, side, quantity, price);
  
  res.json({ message: 'Trade executed' });
});
```

#### Market Data Service

```bash
# Copy the MarketCacheManager
cp services/market-data-service/src/MarketCacheManager.ts services/market-data-service/src/

# In services/market-data-service/src/index.ts, add:
import MarketCacheManager from './MarketCacheManager';

const marketManager = new MarketCacheManager(pool, kafka);
await marketManager.initialize();

// Get price with caching
app.get('/api/v1/market/:symbol', async (req, res) => {
  const price = await marketManager.getStockPrice(req.params.symbol);
  res.json(price);
});

// Broadcast prices every 5 seconds
setInterval(async () => {
  await marketManager.broadcastPrices(TRACKED_SYMBOLS);
}, 5000);
```

#### Risk Management Service

```bash
# Copy the RiskCacheManager
cp services/risk-management-service/src/RiskCacheManager.ts services/risk-management-service/src/

# In services/risk-management-service/src/index.ts, add:
import RiskCacheManager from './RiskCacheManager';

const riskManager = new RiskCacheManager(pool, kafka);
await riskManager.initialize();

// Get risk settings
app.get('/api/v1/risk/:userId', async (req, res) => {
  const settings = await riskManager.getRiskSettings(req.params.userId);
  res.json(settings);
});

// Check risk on price update
kafka.consumer.on('price_updated', async (data) => {
  await riskManager.onPriceUpdate(data.symbol, data.price);
});
```

---

### Step 4: Test Your Implementation (20 minutes)

```bash
# 1. Test cache hit/miss
curl -i http://localhost:3002/api/v1/users/123
# Note the _cached: false and response time

curl -i http://localhost:3002/api/v1/users/123
# Should show _cached: true and <5ms response time

# 2. Check cache health
curl http://localhost:3002/api/v1/health/cache
# Should show connected and hit rate

# 3. Test invalidation
curl -X PUT http://localhost:3002/api/v1/users/123 \
  -H "Content-Type: application/json" \
  -d '{"name": "New Name"}'

curl http://localhost:3002/api/v1/users/123
# Should show _cached: false (fresh from DB)

curl http://localhost:3002/api/v1/users/123
# Should show _cached: true (cached)
```

---

### Environment Variables to Add (.env)

```bash
# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_DEFAULT_TTL=3600
REDIS_KEY_PREFIX=local:
REDIS_POOL_SIZE=10
REDIS_POOL_TIMEOUT=5000

# Kafka (for invalidation)
KAFKA_BROKER=localhost:9092
CACHE_INVALIDATION_ENABLED=true

# Database Connection Pool
DB_POOL_MAX=20
DB_POOL_MIN=5
DB_POOL_IDLE_TIMEOUT=30000
```

---

## Performance Validation Checklist

### After Implementation:
- [ ] Cache responds in <5ms (vs 50-100ms from DB)
- [ ] Cache hit rate >80% after first 100 requests
- [ ] No memory leak (memory stable after initial fill)
- [ ] Data consistency (cached data matches DB)
- [ ] Invalidation works (stale cache removed on update)

### Commands to Verify:

```bash
# Check hit rate
curl http://localhost:3002/api/v1/health/cache | jq '.stats.hitRate'

# Monitor Redis memory
redis-cli INFO memory | grep used_memory_human

# Check active keys
redis-cli KEYS "*" | wc -l

# Monitor real-time operations
redis-cli MONITOR
```

---

## Common Issues & Solutions

### Issue: Cache not connecting
```bash
# Check Redis is running
docker-compose logs redis

# Verify URL
echo $REDIS_URL
# Should be: redis://localhost:6379

# Test connection
redis-cli ping
```

### Issue: High memory usage
```bash
# Check what's in cache
redis-cli KEYS "*" | head -20

# Check size of keys
redis-cli --bigkeys

# Clear cache if needed
redis-cli FLUSHDB
```

### Issue: Stale data after update
```bash
# Make sure invalidation is called:
console.log('Invalidating cache for key...');
await cache.delete(key);

# Check if Kafka message published:
redis-cli KEYS "*:*" # Verify key pattern
```

---

## Quick Performance Test

```typescript
// test-cache.ts  
import CacheService from '../packages/shared-types/src/CacheService';

const cache = new CacheService();
await cache.connect();

console.time('First call (miss)');
let data = await cache.get('test-key') || 
  (await cache.set('test-key', { value: 'test' }, 3600));
console.timeEnd('First call (miss)');

console.time('Second call (hit)');
data = await cache.get('test-key');
console.timeEnd('Second call (hit)');

const stats = cache.getStats();
console.log('Stats:', stats);
```

**Expected output**:
```
First call (miss): 45.32ms
Second call (hit): 1.18ms
Stats: { hits: 1, misses: 1, sets: 1, deletes: 0, hitRate: 50 }
```

---

## Next Steps After Week 1

1. **Run load tests** to verify cache hit rates in production-like conditions
2. **Setup monitoring** with Prometheus/Grafana (Week 3)
3. **Create database indexes** (Week 2)
4. **Enable compression** (Week 3)
5. **Configure CDN** (Week 3)

---

## Success Metrics

Track these metrics:
- ✅ Cache hits at >85%
- ✅ P95 response time <50ms
- ✅ Memory usage stable
- ✅ Data consistency 100%
- ✅ Zero stale data issues

---

## Support Resources

1. **CacheService API**: `packages/shared-types/src/CacheService.ts`
2. **Architecture**: `docs/PHASE_6_DEPLOYMENT_GUIDE.md`
3. **Examples**: Service manager files (Portfolio, Market, Risk)
4. **Patterns**: `docs/PHASE_6_QUICK_REFERENCE.md`

---

**Ready to implement?** Start with Step 1 - should take 2 hours total for a service.
