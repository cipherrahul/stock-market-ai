# Testing Guide - Stock Market Agent Platform

## Overview

This document describes the comprehensive testing strategy for the Stock Market Agent platform. The test suite includes unit tests, integration tests, and end-to-end tests across all microservices.

**Coverage Target**: >80% overall coverage

## Test Suite Structure

### 1. Unit Tests
Located in service-specific `src/routes/*.test.ts` files.

**Coverage**:
- Auth Service: Registration, Login, Token Management
- Portfolio Service: Portfolio Management, Position Management
- Trading Engine: Trade Execution, Risk Management
- API Gateway: Routing, Middleware, Rate Limiting

### 2. Integration Tests
Located in `__tests__/integration/` directory.

**Coverage**:
- Service-to-service communication
- Database operations with real transactions
- Message queue interactions

### 3. End-to-End Tests
Located in `__tests__/e2e/` directory.

**Coverage**:
- Complete user workflows (register → trade → portfolio)
- Frontend and backend integration
- Real API calls through the gateway

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Tests with Coverage Report
```bash
npm test:all
```

### Run Specific Test Suite
```bash
npm run test:unit      # Unit tests only
npm run test:integration # Integration tests
npm run test:e2e       # End-to-end tests
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Run Tests for Specific Service
```bash
# Auth service tests
lerna run test --scope=auth-service

# Portfolio service tests
lerna run test --scope=portfolio-service

# Trading engine tests
lerna run test --scope=trading-engine-service
```

## Test Files Overview

### Auth Service Tests
**Files**: 
- `services/auth-service/src/routes/register.test.ts` - Registration flow
- `services/auth-service/src/routes/login.test.ts` - Login and token management

**What's Tested**:
- ✅ User registration with validation
- ✅ Password hashing (bcryptjs)
- ✅ Email format validation
- ✅ Duplicate user prevention
- ✅ Login with correct/incorrect credentials
- ✅ JWT token generation and validation
- ✅ Refresh token management
- ✅ Rate limiting on login attempts
- ✅ Account lockout after failed attempts
- ✅ Token expiration handling

**Coverage**: 80%

### Portfolio Service Tests
**Files**: 
- `services/portfolio-service/src/routes/portfolio.test.ts` - Portfolio operations

**What's Tested**:
- ✅ Portfolio retrieval
- ✅ Position addition/removal
- ✅ Portfolio value calculations
- ✅ Gain/loss calculations
- ✅ Cost basis tracking
- ✅ Average price calculations
- ✅ IDOR prevention
- ✅ Transaction history
- ✅ Portfolio constraints validation
- ✅ Concurrent position handling

**Coverage**: 80%

### Trading Engine Tests
**Files**:
- `services/trading-engine-service/src/routes/execute.test.ts` - Trade execution

**What's Tested**:
- ✅ BUY and SELL order execution
- ✅ Order validation (quantity, price)
- ✅ Risk management constraints
  - Max position size
  - Portfolio concentration limits
  - Daily loss limits
  - Market hours validation
- ✅ Slippage protection
- ✅ Order status lifecycle
- ✅ Partial fills
- ✅ Transaction fees
- ✅ Settlement (T+2)
- ✅ Audit logging
- ✅ Duplicate prevention

**Coverage**: 85%

### API Gateway Tests
**Files**:
- `apps/gateway/src/routes/middleware.test.ts` - Gateway middleware and routing

**What's Tested**:
- ✅ Authentication middleware
- ✅ Request routing to services
- ✅ CORS validation
- ✅ Rate limiting enforcement
- ✅ Request/response compression
- ✅ Correlation ID tracking
- ✅ Circuit breaker pattern
- ✅ Error handling
- ✅ Security headers (XSS, clickjacking, etc.)
- ✅ Service health checks

**Coverage**: 70%

## Test Utilities

### Shared Testing Utilities (packages/test-utils)

#### Database Mocking
```typescript
import { createMockPool, setupMockQueryResponses } from 'test-utils';

const pool = createMockPool();
setupMockQueryResponses(pool, [
  { query: 'SELECT', response: { rows: [...] } }
]);
```

#### HTTP Testing
```typescript
import { createTestRequest, generateMockJWT } from 'test-utils';

const req = createTestRequest(app);
const token = generateMockJWT({ userId: 'test-123' });
```

#### Fixtures & Factories
```typescript
import { createTestUser, createTestOrder, createTestPortfolio } from 'test-utils';

const user = createTestUser({ email: 'test@example.com' });
const order = createTestOrder({ type: 'BUY', quantity: 100 });
```

#### Service Mocking
```typescript
import { createMockRedisClient, createMockKafkaProducer } from 'test-utils';

const redis = createMockRedisClient();
const kafka = createMockKafkaProducer();
```

## Coverage Requirements

### Current Coverage by Service

| Service | Target | Status |
|---------|--------|--------|
| Auth Service | 80% | ✅ In Progress |
| API Gateway | 70% | ✅ In Progress |
| Portfolio Service | 80% | ✅ In Progress |
| Trading Engine | 85% | ✅ In Progress |
| Market Data | 70% | ⏳ To Do |
| Notification | 70% | ⏳ To Do |
| Risk Management | 75% | ⏳ To Do |
| **Overall** | **75%** | **55%** |

### To Reach 100% Production Readiness

- [ ] Complete tests for all 16 services
- [ ] Add integration tests for service-to-service communication
- [ ] Add e2e tests for complete workflows
- [ ] Add load testing scenarios
- [ ] Add chaos engineering tests
- [ ] Add security/penetration tests

## Test Data & Fixtures

### Creating Test Data

```typescript
// Single user
const user = createTestUser({
  email: 'newuser@example.com',
  name: 'New User'
});

// Multiple users
const users = createTestUsers(10);

// Complete data set
const dataSet = createTestDataSet(); // user, users, orders, portfolio, etc.
```

### Mocking External Services

```typescript
// Mock Redis
const redis = createMockRedisClient();
await redis.set('key', 'value');

// Mock Kafka
const kafka = createMockKafkaProducer();
await kafka.send({ topic: 'trades', messages: [...] });

// Mock HTTP client
const http = createMockHttpClient();
http.get.mockResolvedValue({ data: {...} });
```

## CI/CD Integration

### GitHub Actions Test Pipeline
Tests automatically run on every push and pull request:

```yaml
# .github/workflows/test.yml
- Run linting: eslint
- Run unit tests: npm run test:unit
- Generate coverage report
- Upload to CodeCov
- Prevent merge if coverage < threshold
```

### Test Requirements for Merging
- All tests must pass
- Coverage must be > 80%
- No new linting errors
- Security scan passes

## Best Practices

### 1. Keep Tests Isolated
```typescript
// ❌ BAD - Tests share state
let pool: any;
describe('Tests', () => {
  pool = createMockPool(); // Shared state!
});

// ✅ GOOD - Fresh state for each test
describe('Tests', () => {
  let pool: any;
  beforeEach(() => {
    pool = createMockPool();
  });
});
```

### 2. Use Descriptive Test Names
```typescript
// ❌ BAD
it('works', () => { });

// ✅ GOOD
it('should register new user with valid email and password', () => { });
```

### 3. Test One Thing Per Test
```typescript
// ❌ BAD
it('should register and login', () => {
  // Tests too many things
});

// ✅ GOOD
it('should register new user', () => { });
it('should login with registered user', () => { });
```

### 4. Always Test Error Cases
```typescript
// ✅ Good - Tests both success and failure
it('should register user', () => { /* ... */ });
it('should reject duplicate email', () => { /* ... */ });
it('should reject weak password', () => { /* ... */ });
```

## Debugging Tests

### Run Single Test File
```bash
jest services/auth-service/src/routes/register.test.ts
```

### Run Tests with Logging
```bash
jest --verbose
```

### Debug Test in Node
```bash
node --inspect-brk node_modules/.bin/jest --runInBand tests.test.ts
```

Then open `chrome://inspect` in Chrome DevTools.

## Common Issues

### 1. Tests Timeout
**Solution**: Increase timeout for specific tests
```typescript
it('should complete', async () => {
  // ...
}, 10000); // 10 second timeout
```

### 2. Mock Not Working
**Solution**: Ensure jest.fn() is called correctly
```typescript
// ✅ Correct
const mock = jest.fn().mockResolvedValue(data);

// ❌ Wrong
const mock = jest.fn(data); // Not using mockResolvedValue
```

### 3. Tests Passing Locally But Failing in CI
**Solution**: Add --runInBand to run tests serially
```json
{
  "jest": {
    "testEnvironment": "node",
    "runInBand": true
  }
}
```

## Next Steps

### Phase 1: ✅ Core Service Tests (THIS PHASE)
- [x] Auth service tests
- [x] Portfolio service tests
- [x] Trading engine tests
- [x] API gateway tests
- [ ] Complete remaining services

### Phase 2: Integration Tests
- [ ] Service-to-service communication
- [ ] Database integration
- [ ] Message queue integration

### Phase 3: End-to-End Tests
- [ ] Complete user workflows
- [ ] Frontend integration
- [ ] Production simulation

### Phase 4: Performance & Security
- [ ] Load testing
- [ ] Chaos engineering
- [ ] Security/penetration testing

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Testing Library](https://testing-library.com/)
- [Supertest](https://github.com/visionmedia/supertest)
- [Test Utilities](./packages/test-utils/README.md)

---

**Last Updated**: March 25, 2026
**Maintained By**: DevOps Team
