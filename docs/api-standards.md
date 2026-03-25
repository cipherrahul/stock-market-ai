# API Documentation Standards & Guidelines

## Overview

This guide establishes standards for API documentation across all 16 microservices. All APIs must be documented using OpenAPI 3.0 specification with Swagger UI for interactive exploration.

## OpenAPI Structure

### Minimum Required Document

```yaml
openapi: 3.0.0
info:
  title: Auth Service API
  version: 2.0.0
  description: User authentication and authorization
  contact:
    name: Platform Team
    email: platform@stockmarket.com
  license:
    name: Apache 2.0

servers:
  - url: https://api.stockmarketagent.com
    description: Production
  - url: https://staging-api.stockmarketagent.com
    description: Staging
  - url: http://localhost:3000
    description: Local development

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

security:
  - BearerAuth: []

paths:
  /api/auth/register:
    post:
      summary: Register new user
      operationId: registerUser
      tags:
        - Authentication
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - email
                - password
                - firstName
                - lastName
              properties:
                email:
                  type: string
                  format: email
                  example: user@example.com
                password:
                  type: string
                  format: password
                  minLength: 8
                  example: SecurePass123!
                firstName:
                  type: string
                  minLength: 2
                  maxLength: 50
                lastName:
                  type: string
                  minLength: 2
                  maxLength: 50
      responses:
        '201':
          description: User created successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  data:
                    type: object
                    properties:
                      userId:
                        type: string
                      email:
                        type: string
                      createdAt:
                        type: string
                        format: date-time
        '400':
          description: Invalid input
          content:
            application/json:
              schema:
                type: object
                properties:
                  error:
                    type: string
                  details:
                    type: array
                    items:
                      type: object
        '409':
          description: Email already exists
          content:
            application/json:
              schema:
                type: object
                properties:
                  error:
                    type: string
                  code:
                    type: string
                    enum:
                      - EMAIL_EXISTS
                      - DUPLICATE_USER
```

## 1. Endpoint Documentation Template

Every endpoint must document:

```markdown
### POST /api/auth/login

**Summary**: Authenticate user and return access token

**Security**: None (public endpoint)

**Rate Limit**: 5 requests per 15 minutes per IP

#### Request

**Headers**:
```
Content-Type: application/json
X-Device-Id: (optional) device identifier for multi-device tracking
```

**Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Validation**:
- email: valid email format (RFC 5322)
- password: minimum 8 characters, contains uppercase + lowercase + number + special char

#### Response

**Success (200)**:
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "Bearer",
    "expires_in": 900,
    "user": {
      "id": "usr_123abc",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "USER"
    }
  },
  "correlationId": "1705338225-8b9f2e1"
}
```

**Error (400 - Invalid Credentials)**:
```json
{
  "success": false,
  "error": "INVALID_CREDENTIALS",
  "message": "Email or password is incorrect",
  "correlationId": "1705338225-8b9f2e1"
}
```

**Error (429 - Rate Limited)**:
```json
{
  "success": false,
  "error": "RATE_LIMITED",
  "message": "Too many login attempts. Please try again after 15 minutes.",
  "retryAfter": 847
}
```

#### Examples

```bash
# cURL
curl -X POST https://api.stockmarketagent.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }' | jq .

# JavaScript
const response = await fetch('https://api.stockmarketagent.com/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePass123!'
  })
});
const data = await response.json();
console.log(data.data.access_token);

# Python
import requests
response = requests.post(
  'https://api.stockmarketagent.com/api/auth/login',
  json={'email': 'user@example.com', 'password': 'SecurePass123!'}
)
data = response.json()
token = data['data']['access_token']
```

#### Error Codes

| Code | Status | Meaning | Resolution |
|------|--------|---------|-----------|
| INVALID_CREDENTIALS | 400 | Wrong email or password | Verify credentials and try again |
| EMAIL_NOT_FOUND | 404 | User doesn't exist | Register first or check email |
| ACCOUNT_LOCKED | 403 | Too many failed attempts | Wait 30 minutes or contact support |
| RATE_LIMITED | 429 | Too many requests | Wait before retrying (see retryAfter) |
| SERVER_ERROR | 500 | Internal error | Retry after 1 minute, contact support if persists |
```

## 2. Data Types & Schemas

### Standard Objects

```yaml
# User Object
User:
  type: object
  required:
    - id
    - email
    - firstName
    - lastName
    - role
    - createdAt
  properties:
    id:
      type: string
      format: uuid
      example: usr_123abc456def789
    email:
      type: string
      format: email
    firstName:
      type: string
      minLength: 2
      maxLength: 50
    lastName:
      type: string
      minLength: 2
      maxLength: 50
    role:
      type: string
      enum:
        - USER
        - ADMIN
        - COMPLIANCE
        - SUPPORT
    status:
      type: string
      enum:
        - ACTIVE
        - SUSPENDED
        - DELETED
    createdAt:
      type: string
      format: date-time
    lastLogin:
      type: string
      format: date-time
      nullable: true
      
# Portfolio Object
Portfolio:
  type: object
  required:
    - id
    - userId
    - totalValue
    - totalInvested
    - dayChange
    - dayChangePercent
    - holdings
  properties:
    id:
      type: string
      format: uuid
    userId:
      type: string
      format: uuid
    totalValue:
      type: number
      format: decimal
      example: 1500000.50
    totalInvested:
      type: number
      format: decimal
    dayChange:
      type: number
      format: decimal
    dayChangePercent:
      type: number
      format: float
    holdings:
      type: array
      items:
        $ref: '#/components/schemas/Holding'
        
# Trade Object
Trade:
  type: object
  required:
    - id
    - symbol
    - quantity
    - executionPrice
    - type
    - status
    - executedAt
  properties:
    id:
      type: string
      format: uuid
    symbol:
      type: string
      example: INFY
    quantity:
      type: integer
      minimum: 1
    executionPrice:
      type: number
      format: decimal
    type:
      type: string
      enum:
        - BUY
        - SELL
    status:
      type: string
      enum:
        - PENDING
        - EXECUTED
        - FAILED
        - CANCELLED
    executedAt:
      type: string
      format: date-time
    commission:
      type: number
      format: decimal
    slippage:
      type: number
      format: decimal
```

## 3. Authentication & Authorization

### JWT Token Structure

```typescript
// Access Token (15 min expiry)
{
  "sub": "usr_123abc",        // Subject (user ID)
  "email": "user@example.com",
  "role": "USER",
  "iat": 1705338225,          // Issued At
  "exp": 1705339125,          // Expiration (15 min)
  "iss": "stockmarket-auth",
  "aud": "stockmarket-api"
}

// Refresh Token (7 days expiry, stored in Redis)
{
  "sub": "usr_123abc",
  "type": "refresh",
  "iat": 1705338225,
  "exp": 1705943025,          // 7 days
  "jti": "jti_abc123def456"   // JWT ID for revocation
}
```

### Endpoint Authorization Examples

```
Public endpoints (no auth required):
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/refresh
- GET /api/market/symbols
- GET /api/market/quotes/:symbol

User endpoints (requires USER or higher role):
- GET /api/portfolio
- GET /api/portfolio/history
- POST /api/trading/execute
- GET /api/orders

Admin endpoints (requires ADMIN role):
- GET /api/users
- POST /api/users/:id/suspend
- GET /api/audit/logs
- PATCH /api/settings

Compliance endpoints (requires COMPLIANCE role):
- GET /api/compliance/reports
- GET /api/compliance/transactions
- PATCH /api/compliance/flags/:id
```

## 4. Error Handling

### Standard Error Response

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human readable error message",
  "statusCode": 400,
  "correlationId": "1705338225-8b9f2e1",
  "timestamp": "2024-01-15T14:23:45Z",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format"
    },
    {
      "field": "password",
      "message": "Password too short (min 8 characters)"
    }
  ],
  "doc": "https://docs.stockmarketagent.com/errors/INVALID_INPUT"
}
```

### HTTP Status Codes

```
200 OK              ✅ Request successful
201 Created         ✅ Resource created
204 No Content      ✅ Successful delete/update
400 Bad Request     ❌ Invalid input
401 Unauthorized    ❌ Authentication required
403 Forbidden       ❌ Insufficient permissions
404 Not Found       ❌ Resource doesn't exist
409 Conflict        ❌ Duplicate resource
429 Too Many        ❌ Rate limited
500 Server Error    ❌ Internal error
503 Service Down    ❌ Service unavailable
```

## 5. Rate Limiting

### Default Limits (Per IP)

```
Global:                100 requests / 15 minutes
Authentication:        5 login attempts / 15 minutes
Trading:              50 orders / 15 minutes
Portfolio:            200 requests / 15 minutes
Market Data:          1000 requests / 15 minutes
```

### Rate Limit Headers

```
X-RateLimit-Limit:      100
X-RateLimit-Remaining:  78
X-RateLimit-Reset:      1705339125
X-RateLimit-RetryAfter: 847    (seconds)
```

## 6. Versioning

### API Versions

```
Current: v2.0 (2024)
Previous: v1.5 (2023) - Deprecated, support until 2025-01-01
Deprecated: v1.0 (2022) - No longer supported

Migration guide: https://docs.stockmarketagent.com/migration/v1-to-v2
```

### Version Support Policy

```
Latest version:       Full support
Previous 1 version:   90-day deprecation notice
Older versions:       No longer supported
```

## 7. API Client SDKs

### Official SDKs

```
TypeScript/JavaScript: @stockmarket/api-client
  npm install @stockmarket/api-client

Python:  stockmarket-api
  pip install stockmarket-api

Go: github.com/stockmarket/go-client
  go get github.com/stockmarket/go-client
```

### SDK Example (TypeScript)

```typescript
import { StockMarketAPI, AuthService, PortfolioService } from '@stockmarket/api-client';

const client = new StockMarketAPI({
  baseURL: 'https://api.stockmarketagent.com',
  apiKey: process.env.API_KEY
});

// Register
const user = await client.auth.register({
  email: 'user@example.com',
  password: 'SecurePass123!',
  firstName: 'John',
  lastName: 'Doe'
});

// Login
const { accessToken } = await client.auth.login({
  email: 'user@example.com',
  password: 'SecurePass123!'
});

// Get portfolio
const portfolio = await client.portfolio.get(accessToken);

// Execute trade
const trade = await client.trading.execute(accessToken, {
  symbol: 'INFY',
  quantity: 10,
  type: 'BUY'
});
```

## 8. Webhook Documentation

### Webhook Events

```yaml
Events:
  - trade.executed
  - trade.failed
  - portfolio.updated
  - order.status_changed
  - alert.triggered
  - user.profile.updated

Webhook Endpoint Registration:
POST /api/webhooks/subscribe
{
  "url": "https://yoursite.com/webhooks",
  "events": ["trade.executed", "trade.failed"],
  "secret": "whsec_xyz123"
}
```

### Webhook Payload

```json
{
  "id": "evt_abc123",
  "type": "trade.executed",
  "timestamp": "2024-01-15T14:23:45Z",
  "data": {
    "tradeId": "trd_123",
    "symbol": "INFY",
    "executionPrice": 1500.50,
    "quantity": 100
  },
  "signature": "sha256=8b13e87ed4c5de0ef29cd2e78e19f1dd0e889c4a9e7f"
}
```

### Webhook Verification

```typescript
// Verify webhook signature before processing
import { createHmac } from 'crypto';

const secret = process.env.WEBHOOK_SECRET;
const payload = JSON.stringify(req.body);
const signature = createHmac('sha256', secret).update(payload).digest('hex');

if (signature !== req.headers['x-webhook-signature']) {
  return res.status(401).json({ error: 'Invalid signature' });
}

// Process webhook
console.log(`Received ${req.body.type} event`);
```

## 9. Documentation Publishing

### Generate Documentation

```bash
# From OpenAPI spec
npm run generate:docs

# Generates:
# - Swagger UI: docs/swagger/index.html
# - ReDoc: docs/redoc/index.html
# - HTML: docs/api-reference.html
# - PDF: docs/api-reference.pdf
# - Postman collection: docs/postman-collection.json
```

### Deployment

```
Documentation endpoints:
- Production: https://docs.stockmarketagent.com
- Staging: https://staging-docs.stockmarketagent.com
- Interactive: https://swagger.stockmarketagent.com

Automatic CI/CD updates on every merge
```

## 10. Best Practices Checklist

- [ ] All endpoints have OpenAPI spec
- [ ] All responses include correlationId
- [ ] Error codes are standardized
- [ ] Rate limiting configured
- [ ] Authentication required for sensitive operations
- [ ] Request/response examples provided
- [ ] All data types documented with constraints
- [ ] Deprecation notices included
- [ ] Webhook signatures verified
- [ ] SDK examples included
- [ ] Error handling examples provided
- [ ] Status codes documented (200, 201, 400, 401, 403, 404, 409, 429, 500)
- [ ] Rate limit headers included
- [ ] CORS headers configured
- [ ] API versioning strategy documented
- [ ] Migration guides provided for v1 → v2

## Appendix: Complete Endpoint List

### Auth Service (16 endpoints)
```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout
GET    /api/auth/me
PATCH  /api/auth/password
POST   /api/auth/password-reset
GET    /api/auth/sessions
DELETE /api/auth/sessions/:sessionId
POST   /api/auth/2fa/enable
POST   /api/auth/2fa/verify
POST   /api/auth/2fa/disable
GET    /api/auth/devices
DELETE /api/auth/devices/:deviceId
POST   /api/auth/verify-email
POST   /api/auth/resend-verification
```

### Portfolio Service (12 endpoints)
```
GET    /api/portfolio
GET    /api/portfolio/summary
GET    /api/portfolio/holdings
GET    /api/portfolio/history
GET    /api/portfolio/performance
POST   /api/portfolio/rebalance
GET    /api/portfolio/allocations
GET    /api/portfolio/dividends
PATCH  /api/portfolio/preferences
GET    /api/portfolio/alerts
POST   /api/portfolio/alerts
DELETE /api/portfolio/alerts/:alertId
```

### Trading Service (14 endpoints)
```
POST   /api/trading/execute
GET    /api/trading/orders
GET    /api/trading/orders/:orderId
DELETE /api/trading/orders/:orderId
POST   /api/trading/orders/:orderId/cancel
GET    /api/trading/trades
GET    /api/trading/trades/:tradeId
POST   /api/trading/backtest
GET    /api/trading/strategies
POST   /api/trading/strategies
PATCH  /api/trading/strategies/:id
DELETE /api/trading/strategies/:id
GET    /api/trading/risk-analysis
POST   /api/trading/slippage-analysis
```

### Market Data Service (8 endpoints)
```
GET    /api/market/symbols
GET    /api/market/quotes/:symbol
GET    /api/market/quotes/batch
GET    /api/market/ohlc/:symbol
GET    /api/market/historical/:symbol
GET    /api/market/indices
GET    /api/market/top-gainers
GET    /api/market/top-losers
```

---

**Last Updated**: March 25, 2026
**Maintained By**: Product & Engineering Teams
