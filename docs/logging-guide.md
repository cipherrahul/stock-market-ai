# Structured Logging Implementation Guide

## Overview

All services in the Stock Market Agent platform use centralized structured logging via Winston. This enables:

- **Correlation ID Tracking**: Trace requests across multiple services
- **JSON-formatted Logs**: Easy parsing and analysis in ELK Stack
- **Structured Data**: Consistent log format across all services
- **Performance Metrics**: Track request duration and database query times
- **Audit Trail**: Complete record of all important events

## Configuration

### Environment Variables

```bash
# .env
LOG_LEVEL=info                    # debug, info, warn, error
SERVICE_NAME=auth-service         # Service identifier
NODE_ENV=production               # development, production
```

### Service Initialization

Each service should initialize logging on startup:

```typescript
// src/index.ts
import { logger, logServiceStartup, requestLoggingMiddleware } from '@trading-platform/logger';

const PORT = process.env.PORT || 3000;
const SERVICE_NAME = 'auth-service';

// Initialize logging
logServiceStartup(SERVICE_NAME, PORT);

// Use request logging middleware
app.use(requestLoggingMiddleware);
```

## Usage Examples

### Basic Logging

```typescript
import { logger } from '@trading-platform/logger';

// Info level
logger.info('User login successful', {
  userId: user.id,
  email: user.email,
  ip: req.ip,
});

// Warning level
logger.warn('High memory usage detected', {
  heapUsed: process.memoryUsage().heapUsed,
  threshold: 1000000000,
});

// Error level
logger.error('Database connection failed', {
  error: err.message,
  host: process.env.DB_HOST,
  stack: err.stack,
});
```

### Logging Authentication Events

```typescript
import { logAuthEvent } from '@trading-platform/logger';

// On successful login
logAuthEvent('LOGIN', userId, correlationId, {
  email: user.email,
  ip: req.ip,
  userAgent: req.get('user-agent'),
});

// On failed login
logAuthEvent('AUTH_FAILED', 'unknown', correlationId, {
  email: email,
  reason: 'INVALID_PASSWORD',
  attemptCount: 3,
});
```

### Logging Trading Events

```typescript
import { logTradingEvent } from '@trading-platform/logger';

// Order executed
logTradingEvent('ORDER_EXECUTED', userId, orderId, correlationId, {
  symbol: 'AAPL',
  quantity: 100,
  price: 150.50,
  type: 'BUY',
  executedPrice: 150.48,
  fees: 15.05,
});

// Order failed
logTradingEvent('TRADE_FAILED', userId, orderId, correlationId, {
  reason: 'INSUFFICIENT_BALANCE',
  requiredBalance: 15050,
  availableBalance: 10000,
});
```

### Logging Risk Events

```typescript
import { logRiskEvent } from '@trading-platform/logger';

// Risk limit exceeded
logRiskEvent('RISK_LIMIT_EXCEEDED', userId, correlationId, {
  riskType: 'DAILY_LOSS',
  currentLoss: 3500,
  limit: 3000,
  portfolioValue: 100000,
});
```

### Logging Database Operations

```typescript
import { logDatabaseQuery } from '@trading-platform/logger';

const startTime = Date.now();
try {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
  logDatabaseQuery(
    'SELECT * FROM users WHERE id = $1',
    Date.now() - startTime,
    correlationId
  );
  return result.rows[0];
} catch (error) {
  logDatabaseQuery(
    'SELECT * FROM users WHERE id = $1',
    Date.now() - startTime,
    correlationId,
    error
  );
  throw error;
}
```

## Correlation ID Usage

Correlation IDs enable tracing requests across microservices:

```typescript
// Express middleware automatically captures X-Request-ID
// or generates a new one if not provided

// In downstream services, include correlation ID:
const correlationId = req.get('X-Request-ID') || '(not-provided)';

logger.info('Processing request', {
  correlationId,
  userId: req.user.id,
  path: req.path,
});

// Forward to other services
const response = await axios.get('http://auth-service/api/verify', {
  headers: {
    'X-Request-ID': correlationId,
  },
});
```

## Log Output Format

### Structured JSON Format

All logs output as structured JSON for easy parsing:

```json
{
  "timestamp": "2024-01-15 14:23:45",
  "level": "INFO",
  "service": "auth-service",
  "environment": "production",
  "message": "User login successful",
  "correlationId": "1705338225-8b9f2e1",
  "userId": "user-123",
  "email": "user@example.com",
  "ip": "192.168.1.100",
  "metadata": {
    "userAgent": "Mozilla/5.0..."
  }
}
```

### Request/Response Logs

```json
{
  "timestamp": "2024-01-15 14:23:45",
  "level": "INFO",
  "service": "api-gateway",
  "message": "Incoming request",
  "correlationId": "1705338225-8b9f2e1",
  "method": "POST",
  "path": "/api/auth/login",
  "userId": "user-123",
  "ip": "192.168.1.100"
}

{
  "timestamp": "2024-01-15 14:23:46",
  "level": "INFO",
  "service": "api-gateway",
  "message": "Outgoing response",
  "correlationId": "1705338225-8b9f2e1",
  "method": "POST",
  "path": "/api/auth/login",
  "statusCode": 200,
  "duration": 145,
  "userId": "user-123"
}
```

### Error Logs

```json
{
  "timestamp": "2024-01-15 14:23:46",
  "level": "ERROR",
  "service": "portfolio-service",
  "message": "Database query error",
  "correlationId": "1705338225-8b9f2e1",
  "error": "connection refused",
  "stack": "Error: connection refused\n  at ...",
  "query": "SELECT * FROM portfolios WHERE user_id = $1",
  "duration": 5000
}
```

## Log Levels

| Level | Usage | Examples |
|-------|-------|----------|
| DEBUG | Detailed diagnostic info | Database query details, full request/response bodies |
| INFO | General informational | Service startup, user actions, successful operations |
| WARN | Warning conditions | High memory usage, rate limit approaching |
| ERROR | Error conditions | Failed operations, exceptions, service failures |

## Best Practices

### 1. Always Include Context

```typescript
// ❌ Bad - No context
logger.info('User login');

// ✅ Good - Clear context
logger.info('User login successful', {
  userId: user.id,
  email: user.email,
  duration: loginTime,
});
```

### 2. Sanitize Sensitive Information

```typescript
// ❌ Bad - Passwords exposed
logger.info('User login', {
  email: user.email,
  password: req.body.password, // NEVER LOG PASSWORDS
});

// ✅ Good - Only log necessary info
logger.info('User login', {
  userId: user.id,
  email: user.email,
});
```

### 3. Use Correlation IDs for Request Tracing

```typescript
// All logs related to a request should include correlationId
logger.info('Processing request', { correlationId });
logger.info('Querying database', { correlationId });
logger.info('Sending response', { correlationId });
```

### 4. Log Errors with Context

```typescript
// ✅ Good - Include error context
logger.error('Failed to execute trade', {
  correlationId,
  userId,
  orderId,
  error: error.message,
  stack: error.stack,
  failureReason: 'INSUFFICIENT_BALANCE',
  requiredAmount: 15000,
  availableAmount: 10000,
});
```

### 5. Monitor Log Output

```typescript
// Development: Console output for quick debugging
// Production: File output + log aggregation service
```

## Log Aggregation (ELK Stack Integration)

Logs are automatically JSON-formatted for Kibana ingestion:

### Shippingfrom Files to Elasticsearch

```bash
# Configure Filebeat to ship logs
/logs/*.log -> Elasticsearch -> Kibana
/logs/errors/*.log -> Elasticsearch -> Kibana
```

### Kibana Queries

```json
// Find all errors for a user
{
  "query": {
    "bool": {
      "must": [
        { "match": { "level": "ERROR" } },
        { "match": { "userId": "user-123" } }
      ]
    }
  }
}

// Trace request across services by correlation ID
{
  "query": {
    "match": { "correlationId": "1705338225-8b9f2e1" }
  }
}

// Find slow database queries
{
  "query": {
    "bool": {
      "must": [
        { "match": { "message": "Database query" } },
        { "range": { "duration": { "gte": 1000 } } }
      ]
    }
  }
}
```

## Troubleshooting

### Logs Not Appearing

1. Check log level is not too high:
   ```bash
   LOG_LEVEL=debug npm run dev
   ```

2. Verify winston transports are configured

3. Check file permissions on logs directory:
   ```bash
   mkdir -p logs
   chmod 755 logs
   ```

### Performance Impact

- JSON formatting is lightweight (~1ms per log)
- File rotation prevents log files from growing too large
- Consider increasing LOG_LEVEL to `warn` in production for high-traffic services

## Next Steps

1. Integrate with ELK Stack for log aggregation
2. Set up Kibana dashboards for monitoring
3. Create alerts for error spikes
4. Implement log retention policies

## References

- [Winston Documentation](https://github.com/winstonjs/winston)
- [ELK Stack](https://www.elastic.co/what-is/elk-stack)
- [Kibana](https://www.elastic.co/kibana)
