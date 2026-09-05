# Operational Runbooks: Sovereign AI Platform

## 1. Environment & Cryptography Hardening

### Generate Master Encryption Key
The system mandates an **AES-256-CBC** key consisting of exactly 32 ASCII characters.
In PowerShell:
```powershell
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$key = [System.Convert]::ToBase64String($bytes).Substring(0, 32)
Write-Host "SYSTEM_ENCRYPTION_KEY=$key"
```

### Encrypt Broker Tokens
Encrypt sensitive broker access tokens before writing to `.env`:
```bash
npx tsx scripts/encrypt_token.ts "your_raw_access_token_here"
```
Place output in `.env` as:
- `ZERODHA_ACCESS_TOKEN_ENC=<iv_hex>:<cipher_hex>`
- `UPSTOX_ACCESS_TOKEN_ENC=<iv_hex>:<cipher_hex>`

### Rotate Credentials
To re-encrypt all stored credentials after updating `SYSTEM_ENCRYPTION_KEY`:
```bash
npx tsx scripts/rotate_keys.ts
```

---

## 2. Database Initialization & Seeding

### Initialize via Docker
```bash
docker-compose up -d postgres redis zookeeper kafka
```

### Initialize via Local PostgreSQL (Windows)
Ensure PostgreSQL is running on port 5432:
```powershell
# Setup DB & apply 2026 schema:
node scripts/setup-db.js
```
Or using PowerShell native script:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-db.ps1
```

---

## 3. Starting the Fleet

### Windows Native Realtime Quick-Start
To start core real-time services locally in separate windows:
```cmd
start-realtime-system.bat
```
This spawns:
1. Market Data Service (`3003`)
2. API Gateway with WebSocket (`3000`)
3. Auth Service (`3001`)
4. Portfolio Service (`3005`)
5. Trading Engine (`3006`)
6. AI Engine Service (`3004`)
7. Risk Management Service (`3010`)
8. Notification Service (`3009`)

To start the Next.js frontend:
```bash
cd apps/web && npm run dev
```

### Full 16-Service Docker Deployment
To launch the complete institutional fleet with Kafka, Zookeeper, and all microservices:
```bash
docker-compose -f docker-compose-complete.yml up -d --build
```
Check logs:
```bash
docker-compose -f docker-compose-complete.yml logs -f agent-orchestrator bill-payment-service
```

### Clean Shutdown
```cmd
# Stop local node services
taskkill /F /IM node.exe /T

# Stop Docker fleet
docker-compose -f docker-compose-complete.yml down
```

---

## 4. Health Verification & Telemetry

### Ping All Core Service Health Endpoints (PowerShell)
```powershell
$endpoints = @(
    "http://localhost:3000/health",
    "http://localhost:3001/health",
    "http://localhost:3002/health",
    "http://localhost:3003/health",
    "http://localhost:3004/health",
    "http://localhost:3005/health",
    "http://localhost:3006/health",
    "http://localhost:3007/health",
    "http://localhost:3008/health",
    "http://localhost:3009/health",
    "http://localhost:3010/health",
    "http://localhost:3011/health",
    "http://localhost:3012/health",
    "http://localhost:3016/health"
)

foreach ($url in $endpoints) {
    try {
        $res = Invoke-RestMethod -Uri $url -TimeoutSec 3
        Write-Host "✅ $url : $($res | ConvertTo-Json -Compress)" -ForegroundColor Green
    } catch {
        Write-Host "❌ $url : Unreachable" -ForegroundColor Red
    }
}
```

### Run Phase 6 Stress Test (Sovereign Flows)
```bash
python scripts/verify_sovereign_v6.py
```
Validates:
- High-Alpha Liquidity Gap detection
- Emergency Sweep Protocol
- PPO Policy Reinforcement Update

### Run Phase 8 Stress Test (CFO Agent Flows)
```bash
python scripts/verify_cfo_v8.py
```
Validates:
- Financial Liveness Protection Wall (Rent/Utilities lock)
- Autonomous Bill Settlement via Stripe
- Debt Interest Optimization / APR Reduction

---

## 5. Emergency Procedures (Kill-Switch & Sweep)

### 1. Manual Circuit Breaker Trigger
To immediately halt all autonomous trading across the fleet:
```bash
curl -X POST http://localhost:3010/api/v1/risk/kill-switch \
  -H "Content-Type: application/json" \
  -d '{"reason": "MANUAL_OPERATOR_INTERVENTION", "durationMinutes": 60}'
```

### 2. Emergency Broker-to-Bank Sweep
If broker stability or systemic contagion is detected, sweep unallocated broker capital to primary bank storage:
```bash
curl -X POST http://localhost:3015/api/v1/liquidity/emergency-sweep \
  -H "Content-Type: application/json" \
  -d '{"userId": "user_123", "destination": "PRIMARY_BANK_VAULT"}'
```
