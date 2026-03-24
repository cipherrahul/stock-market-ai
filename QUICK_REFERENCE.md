# QUICK REFERENCE: Production System Checklist

## 🎯 What Changed?

### ❌ REMOVED
- ✅ All `localhost:xxxx` hardcoding
- ✅ Development/mock authentication modes
- ✅ Test credentials in code
- ✅ Single JWT token system
- ✅ Basic error messages
- ✅ Manual rate limiting
- ✅ Unstructured logging

### ✅ ADDED
- ✅ Docker service discovery (DNS-based)
- ✅ Dual JWT tokens (access + refresh)
- ✅ Comprehensive input validation
- ✅ Token refresh endpoint
- ✅ Structured JSON logging
- ✅ Correlation ID tracking
- ✅ Circuit breaker pattern
- ✅ Health check endpoints
- ✅ Graceful shutdown handlers
- ✅ Token expiry management

---

## 🚀 Quick Start (Production)

### Environment Setup
```bash
# Copy production environment
cp .env.production .env

# Update with real secrets
export NODE_ENV=production
export JWT_SECRET="your-super-secret-key-min-32-chars"
export JWT_REFRESH_SECRET="your-super-secret-refresh-key"
export DB_HOST="your-postgres-host"
export DB_PASSWORD="your-postgres-password"
export REDIS_URL="redis://your-redis-host:6379"
```

### Build & Deploy
```bash
# Validate everything
./scripts/validate-production.sh

# Build services
npm run build

# Start with Docker
docker-compose -f docker-compose-complete.yml up -d

# Verify all services are healthy
curl http://localhost:3000/health
curl http://localhost:3001/health
```

---

## 🔐 Authentication Flow (Production)

```
User Login
   ↓
POST /api/v1/auth/login (email, password)
   ↓
[Auth Service validates credentials against DB]
   ↓
Return: { accessToken (15m), refreshToken (7d), user }
   ↓
[Frontend stores both tokens in localStorage]
   ↓
API calls use accessToken in Authorization header
   ↓
When accessToken expires → POST /api/v1/auth/refresh
   ↓
[Return new accessToken]
   ↓
Resume normal operation
```

---

## 📍 Service URLs (Docker)

```
API Gateway:      http://api-gateway:3000
Auth Service:     http://auth-service:3001
Market Service:   http://market-data-service:3001
User Service:     http://user-service:3001
Portfolio:        http://portfolio-service:3001
Trading:          http://trading-engine-service:3001
Database:         postgres:5432
Redis:            redis:6379
Kafka:            kafka:9092
```

---

## 📋 Health Checks

```bash
# Gateway health
curl http://localhost:3000/health
# Output: {status: 'healthy', service: 'api-gateway', dependencies: {...}}

# Auth service health
curl http://localhost:3001/health
# Output: {status: 'healthy', service: 'auth-service', dependencies: {...}}

# Readiness (orchestration)
curl http://localhost:3000/ready
# Output: {status: 'ready', service: 'api-gateway'}
```

---

## 🔑 API Endpoints (Production)

### Authentication
```
POST /api/v1/auth/register
POST /api/v1/auth/login          → Returns {accessToken, refreshToken}
POST /api/v1/auth/refresh        → Returns {accessToken}
POST /api/v1/auth/verify         → Requires Bearer token
POST /api/v1/auth/logout         → Requires Bearer token
```

### Protected Routes (All require Bearer token)
```
GET  /api/v1/market/stocks/:symbol
GET  /api/v1/market/quote/:symbol
GET  /api/v1/portfolio/:userId
POST /api/v1/trading/execute
GET  /api/v1/users/:userId
... and 20+ more routes
```

---

## 🛡️ Security Headers (Automatic)

All responses include:
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000
Content-Security-Policy: directives...
Referrer-Policy: strict-origin-when-cross-origin
```

---

## 📊 Rate Limits (Per IP)

```
Authentication:  5 requests per 15 minutes
API General:     100 requests per 1 minute
```

**Exceed limit** → HTTP 429 (Too Many Requests)

---

## 🔍 Logging Format (Production)

All logs are JSON-formatted:
```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "INFO",
  "requestId": "uuid-here",
  "method": "POST",
  "path": "/api/v1/auth/login",
  "statusCode": 200,
  "duration": "45ms"
}
```

**View logs**: `docker-compose logs -f service-name`

---

## ⚠️ Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| ECONNREFUSED 3001 | Auth service not running → `docker-compose up -d` |
| API_URL not set | Set `NEXT_PUBLIC_API_URL` environment variable |
| Token refresh fails | Redis not connected → check Redis environment |
| CORS error | Check `CORS_ORIGIN` environment variable |
| 429 Too Many Requests | Rate limit exceeded → wait 15 minutes or check IP |
| Database connection refused | DB not running → verify `DB_HOST`, `DB_PORT` |

---

## 🔄 Token Lifecycle

```
⏱️ Login Time T=0
  ├─ Access Token: Valid until T+15min
  ├─ Refresh Token: Valid until T+7days
  └─ Stored in localStorage

T+10min - User makes API call
  └─ Uses accessToken (still valid)

T+14min 30sec - Auto-refresh triggered
  ├─ POST /api/v1/auth/refresh
  ├─ Receives new accessToken (valid until T+14min 45sec)
  └─ User unaware of refresh

T+24hours - Refresh token expired
  └─ Automatic logout → redirect to /login

User Logout - Manual
  └─ DELETE /api/v1/auth/logout
  └─ Clear localStorage
  └─ Redirect to /login
```

---

## 🚨 Circuit Breaker States

```
CLOSED (Normal)
  └─ All requests go through
  └─ Service is healthy

OPEN (Service Down)
  └─ Requests fail immediately
  └─ Return 503 Service Unavailable
  └─ Wait 60 seconds

HALF-OPEN (Recovery Testing)
  └─ Allow some requests through
  └─ If 2 succeed → CLOSED
  └─ If any fail → OPEN again
```

---

## 📈 Scalability Ready

✅ **Stateless services** - No session affinity needed
✅ **Service discovery** - Works with Docker/Kubernetes
✅ **Horizontal scaling** - Add more instances
✅ **Load balancing** - Round-robin compatible
✅ **Database pooling** - Connection reuse
✅ **Caching** - Redis cache layer
✅ **Circuit breaker** - Failure isolation

---

## 🔗 Important Links

- **Deployment Guide**: [PRODUCTION_DEPLOYMENT_GUIDE.md](PRODUCTION_DEPLOYMENT_GUIDE.md)
- **Full Transformation**: [PRODUCTION_TRANSFORMATION_SUMMARY.md](PRODUCTION_TRANSFORMATION_SUMMARY.md)
- **Validation Script**: `./scripts/validate-production.sh`
- **Environment Config**: `.env.production`

---

## 💡 Developer Tips

### Debug Token Issues
```bash
# Check stored tokens
localStorage.getItem('accessToken')
localStorage.getItem('refreshToken')
localStorage.getItem('accessTokenExpiry')

# Decode JWT (in browser console)
JSON.parse(atob(token.split('.')[1]))
```

### Monitor Service Communication
```bash
# Watch auth service logs
docker-compose logs -f auth-service

# Watch gateway logs
docker-compose logs -f api-gateway

# Watch all services
docker-compose logs -f
```

### Test API Locally
```bash
# Register user
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Password123","name":"Test User"}'

# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Password123"}'

# Use refreshToken from login response
curl -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"your-refresh-token-here"}'
```

---

**System Status**: ✅ Production Ready for Deployment
**Last Updated**: $(date)
**Version**: 1.0.0
