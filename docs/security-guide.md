# Security Hardening Guide

## Overview

This guide covers security best practices, hardening strategies, and compliance measures for the Stock Market Agent platform. It addresses authentication, authorization, data protection, audit logging, and incident response.

**Security Checklist**:
- [x] RBAC implementation
- [x] Network policies
- [x] Audit logging
- [x] Secret management
- [x] Rate limiting
- [x] Input validation & sanitization
- [x] XSS/CSRF protection
- [x] SQL injection prevention
- [ ] Penetration testing
- [ ] Security audit

## 1. User Authentication & Authorization

### JWT Token Strategy

#### Access Token (Short-lived)
```
Expiration: 15 minutes
Claims:
  - sub: user_id
  - email: user@example.com
  - role: user|admin
  - iat: issued_at
  - exp: expiration_time
```

#### Refresh Token (Long-lived)
```
Expiration: 7 days
Claims:
  - sub: user_id
  - type: refresh
  - iat: issued_at
  - exp: expiration_time

Storage: Redis with revocation support
```

### Implementation

```typescript
// Auth Service - Token Generation
import jwt from 'jsonwebtoken';

const generateAccessToken = (userId: string, role: string) => {
  return jwt.sign(
    {
      sub: userId,
      role,
      type: 'access',
    },
    process.env.JWT_SECRET!,
    { expiresIn: '15m' }
  );
};

const generateRefreshToken = (userId: string) => {
  const token = jwt.sign(
    {
      sub: userId,
      type: 'refresh',
    },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: '7d' }
  );

  // Store in Redis for revocation
  redis.set(`refresh:${userId}:${token}`, 'active', { EX: 7 * 24 * 60 * 60 });
  return token;
};

// Token Validation Middleware
const validateToken = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    (req as any).user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};
```

## 2. Role-Based Access Control (RBAC)

### User Roles

```
USER (default)
├── View own portfolio
├── Place trades
├── View own history
└── Update own settings

ADMIN
├── All USER permissions
├── Manage users
├── View audit logs
├── System settings
└── Risk management overrides

COMPLIANCE
├── View all portfolios (read-only)
├── View all trades (read-only)
├── Export audit logs
└── Generate compliance reports

SUPPORT
├── View user issues
├── Reset passwords
└── Temporary account access
```

### RBAC Middleware

```typescript
const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = (req as any).user?.role;
    
    if (!userRole || !allowedRoles.includes(userRole)) {
      logger.warn('Unauthorized access attempt', {
        userId: (req as any).user?.sub,
        requiredRoles: allowedRoles,
        userRole,
      });
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    next();
  };
};

// Usage
app.get('/admin/users', requireRole(['ADMIN']), handler);
app.get('/portfolio', requireRole(['USER', 'ADMIN']), handler);
```

## 3. Data Protection

### Encryption at Rest

```bash
# PostgreSQL encryption
ALTER SYSTEM SET ssl = on;
ALTER SYSTEM SET password_encryption = scram-sha-256;

# Sensitive fields encryption
CREATE COLUMN ENCRYPTION KEY WITH (
  ALGORITHM = 'AES-256-GCM'
);
```

### Encryption in Transit

```
- All APIs: HTTPS/TLS 1.3
- Service-to-service: mTLS
- Database: SSL/TLS
- Redis: Encrypted connections

Certificates: Let's Encrypt with automatic renewal
```

### Password Hashing

```typescript
import bcrypt from 'bcryptjs';

// Hash password on registration
const salt = await bcrypt.genSalt(12);
const hashedPassword = await bcrypt.hash(password, salt);

// Verify on login
const isValid = await bcrypt.compare(inputPassword, hashedPassword);

// Cost factor: 12 (takes ~260ms on modern hardware)
```

## 4. Secret Management

### Environment Variables (Development)

```bash
.env (LOCAL ONLY - Never commit)
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
DB_PASSWORD=db-password
REDIS_PASSWORD=redis-password
API_KEYS=api-key-1,api-key-2
```

### AWS Secrets Manager (Production)

```bash
# Store secrets
aws secretsmanager create-secret \
  --name prod/jwt-secret \
  --secret-string $(cd /dev/urandom && tr -dc '[:alnum:]' | head -c 32)

# Retrieve in application
const secret = await secretsManager.getSecretValue({
  SecretId: 'prod/jwt-secret'
});
```

### Secret Rotation

```bash
# Rotate JWT secrets (migrate users gradually)
1. Create new JWT_SECRET_NEW
2. Accept both OLD and NEW secrets for validation
3. Issue new refresh tokens with NEW secret
4. After 24h, deprecate OLD secret
5. Deactivate OLD secret after 7 days

# Rotate database passwords
1. Create new DB user with new password
2. Update connection strings
3. Transfer permissions to new user
4. Delete old user after verification
```

## 5. Input Validation & Sanitization

### Validation Library

```typescript
import Joi from 'joi';
import xss from 'xss';

// Schema definition
const userRegisterSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string()
    .min(8)
    .max(128)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
    .required(),
  name: Joi.string().max(100).required(),
});

// Validate and sanitize
app.post('/register', async (req, res) => {
  // Validate schema
  const { error, value } = userRegisterSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  // Sanitize input
  const sanitizedName = xss(value.name);
  const sanitizedEmail = xss(value.email);

  // Process
  // ...
});
```

### SQL Injection Prevention

```typescript
// ❌ VULNERABLE - String concatenation
const query = `SELECT * FROM users WHERE email = '${email}'`;

// ✅ SAFE - Parameterized queries
const query = 'SELECT * FROM users WHERE email = $1';
const result = await pool.query(query, [email]);
```

### XSS Protection

Headers configured in API Gateway:

```typescript
import helmet from 'helmet';

// Security headers
app.use(helmet());
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://trusted-cdn.com'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  })
);

// XSS filter middleware
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = xss(req.body[key]);
      }
    }
  }
  next();
});
```

### CSRF Protection

```typescript
import csrf from 'csurf';

const csrfProtection = csrf({ cookie: false });

app.post('/api/trading/execute', csrfProtection, (req, res) => {
  // Token automatically validated
  // Process trade
});

// Frontend must include token
const token = document.querySelector('[name=_csrf]').value;
axios.post('/api/trading/execute', data, {
  headers: { 'X-CSRF-Token': token }
});
```

## 6. Rate Limiting

### Configuration

```typescript
import rateLimit from 'express-rate-limit';

// Global rate limit
const global LimitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests',
  standardHeaders: true,
  legacyHeaders: false,
});

// Per-user rate limit
const userLimitLimiter = rateLimit({
  keyGenerator: (req) => (req as any).user?.sub,
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // Limit each user to 10 requests per minute
});

// Login attempt rate limit
const loginLimiter = rateLimit({
  keyGenerator: (req) => req.body.email,
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 attempts per 15 minutes
  skipSuccessfulRequests: true, // Don't count successful logins
});

app.use(globalLimiter);
app.post('/login', loginLimiter, loginHandler);
app.post('/api/trading', userLimitLimiter, tradingHandler);
```

## 7. Audit Logging

### Audit Log Schema

```sql
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  user_id UUID NOT NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id VARCHAR(100),
  old_value JSONB,
  new_value JSONB,
  ip_address INET,
  user_agent TEXT,
  correlation_id VARCHAR(100),
  status VARCHAR(20), -- SUCCESS, FAILURE
  error_message TEXT
);

CREATE INDEX idx_audit_timestamp ON audit_log(timestamp DESC);
CREATE INDEX idx_audit_user_action ON audit_log(user_id, action);
```

### Audit Logging Implementation

```typescript
async function auditLog(
  userId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  req: Request,
  status: 'SUCCESS' | 'FAILURE',
  oldValue?: any,
  newValue?: any,
  errorMessage?: string
) {
  const query = `
    INSERT INTO audit_log (
      user_id, action, resource_type, resource_id,
      old_value, new_value, ip_address, user_agent,
      correlation_id, status, error_message
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
  `;

  await pool.query(query, [
    userId,
    action,
    resourceType,
    resourceId,
    JSON.stringify(oldValue),
    JSON.stringify(newValue),
    req.ip,
    req.get('user-agent'),
    (req as any).correlationId,
    status,
    errorMessage,
  ]);

  logAuditEvent(action, {
    userId,
    resourceType,
    resourceId,
    status,
  });
}

// Usage
app.post('/api/portfolio/update', async (req, res) => {
  try {
    const oldValue = await getPortfolio(portfolioId);
    const newValue = { ...oldValue, ...req.body };

    await updatePortfolio(newValue);
    await auditLog(
      userId,
      'PORTFOLIO_UPDATE',
      'PORTFOLIO',
      portfolioId,
      req,
      'SUCCESS',
      oldValue,
      newValue
    );

    res.json(newValue);
  } catch (error) {
    await auditLog(
      userId,
      'PORTFOLIO_UPDATE',
      'PORTFOLIO',
      portfolioId,
      req,
      'FAILURE',
      undefined,
      undefined,
      (error as Error).message
    );
    res.status(500).json({ error: 'Update failed' });
  }
});
```

## 8. Security Headers

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

## 9. Compliance Requirements

### GDPR

```
✅ User data erasure (right to be forgotten)
✅ Data portability
✅ Consent management
✅ Privacy policy
✅ Data processing agreements
```

### SOX (Sarbanes-Oxley)

```
✅ Audit trail for all financial transactions
✅ User access controls
✅ Change management
✅ IT general controls
✅ Financial data integrity
```

### PCI DSS (if handling cards)

```
✅ Encrypted data transmission
✅ Restricted card data access
✅ Regular security testing
✅ Access control policies
✅ Secure password management
```

## 10. Incident Response Plan

### Security Incident Classification

| Severity | Response Time | Examples |
|----------|---------------|----------|
| P0 - Critical | 15 minutes | Data breach, account takeover |
| P1 - High | 1 hour | Unauthorized access, injection attack |
| P2 - Medium | 4 hours | Rate limit bypass, authentication issues |
| P3 - Low | 24 hours | Configuration issues, minor bugs |

### Incident Response Steps

```
1. DETECT: Monitoring alerts, user reports
2. ASSESS: Severity, scope, impact
3. CONTAIN: Isolate affected systems
4. COMMUNICATE: Notify stakeholders, users (if needed)
5. FIX: Patch vulnerability
6. VERIFY: Test fix in staging
7. DEPLOY: Roll out fix to production
8. MONITOR: Enhanced monitoring post-fix
9. DOCUMENT: Post-mortem, lessons learned
10. PREVENT: Implement preventive measures
```

### Example: Account Takeover Incident

```bash
1. Detect: Unusual login from new IP detected
2. Assess: Check audit logs for suspicious activity
3. Contain: 
   - Revoke all active sessions
   - Force password reset
   - Send security alert to user
4. Communicate:
   - User notification email
   - Security team notification
5. Fix:
   - Strengthen rate limiting
   - Add MFA requirement
6. Verify: Test in staging
7. Deploy: Roll out MFA requirement
8. Monitor: Watch for similar incidents
```

## Security Checklist

- [ ] All passwords hashed with bcrypt (cost 12)
- [ ] JWT tokens signed with strong secret (32+ chars)
- [ ] HTTPS/TLS 1.3 enabled
- [ ] CORS properly configured
- [ ] Rate limiting enforced
- [ ] Input validation on all endpoints
- [ ] XSS protection headers set
- [ ] CSRF tokens required for state-changing requests
- [ ] SQL injection prevention (parameterized queries)
- [ ] Audit logging for sensitive operations
- [ ] Secrets not in code/logs
- [ ] RBAC implemented
- [ ] Network policies enforced
- [ ] Pod security policies enforced
- [ ] Regular security updates
- [ ] Penetration testing completed
- [ ] Security audit passed

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express.js Security](https://expressjs.com/en/advanced/best-practice-security.html)
- [Kubernetes Security](https://kubernetes.io/docs/concepts/security/)

---

**Last Updated**: March 25, 2026
**Reviewed By**: Security Team
