# Sovereign AI Fleet Architecture & Protocol Reference

## 1. 16-Microservice Fleet Registry

| Service | Port | Domain | Primary Tech | Main Responsibility | Upstream / Downstream |
|---------|------|--------|--------------|---------------------|-----------------------|
| **api-gateway** | 3000 | Ingress / Routing | Node.js / Express / WS | Client ingress, route proxying, auth forwarding, `/ws` market ticks | Client -> Gateway -> Internal Fleet |
| **auth-service** | 3001 | Identity & Cryptography | Node.js / JWT / AES-256 | User authentication, token issuance, credential decryption | Gateway <-> Postgres / Redis |
| **user-service** | 3002 | User Profiles | Node.js / Express | Risk profiling, KYC, user preferences | Gateway <-> Postgres |
| **market-data-service** | 3003 | Market Feeds | Node.js / WebSockets / Kafka | Live ticker streaming (NSE/BSE/US), order book delta, Redis caching | Broker -> Kafka (`market_ticks`) -> Gateway |
| **ai-engine-service** | 3004 | ML Intelligence | Python / FastAPI / TF / RF | LSTM neural inference, technical indicators, sentiment weighting, signal generation | Redis / PG -> Kafka (`ai_signals`) |
| **portfolio-service** | 3005 | The Vault & Ledgers | Node.js / Express | Cash balances, positions, multi-currency ledger, deposit/withdraw | Trading Engine / CFO <-> Postgres |
| **trading-engine-service** | 3006 | Execution Engine | Node.js / TypeScript | Order lifecycle, Smart Order Routing (SOR), idempotency, paper/live mode | Orchestrator -> Trading Engine -> Broker |
| **broker-integration-service** | 3007 | Broker Connectors | Node.js / TypeScript | KiteConnect (Zerodha), Upstox v2, Alpaca adapters, AES-256 credentials | Trading Engine -> Broker Gateway -> Stock Exchanges |
| **backtesting-service** | 3008 | Simulation | Node.js / TypeScript | Historical simulation across 1,000 variance paths, strategy backtests | Postgres / Market History |
| **notification-service** | 3009 | Alert Delivery | Node.js / Kafka / Redis | Push notifications, trade alerts, Slack webhook integration | Kafka (`trade_events`, `cfo_actions`) -> User |
| **risk-management-service** | 3010 | Risk Guard & Circuit Breaker | Node.js / TypeScript / Kafka | Real-time VaR, max drawdown limit, 3-sigma entropy shock, emergency stop | Kafka (`portfolio_updates`) -> Kafka (`kill_switch`) |
| **sentiment-service** | 3011 | Sentiment Ingestion | Node.js / Python / Redis | RSS/News sentiment scoring (-1.0 to +1.0), correlation with symbols | News API -> Redis (`sentiment:<SYM>`) |
| **agent-orchestrator** | 3012 | Alpha Hunter & Hedging | Node.js / TypeScript / Kafka | Consumes AI signals (confidence >= 75%), dynamic sizing, SQQQ/VIX hedging | Kafka (`ai_signals`) -> Trading Engine (:3006) |
| **debt-management-service** | 3014 | Liability Optimization | Node.js / Express | APR optimization, debt avalanche/snowball payoff from alpha gains | CFO Loop <-> Postgres (`liabilities`) |
| **liquidity-management-service** | 3015 | Bank/Broker Sweeper | Node.js / Express | 14-day Sandbox Hardlock, broker-to-bank sweep on max drawdown, liquidity gap | Bank Bridge <-> Portfolio Service (:3005) |
| **bill-payment-service** | 3016 | CFO Bill Settlement | Node.js / Stripe / Plaid | Autonomous 60s loop checking pending bills, checking liquidity, executing payment | Postgres (`bills`) -> Stripe Gateway -> Kafka (`cfo_actions`) |
| **web** | 5000 / 3000 | Sovereign Command Center | Next.js 15 / React / Tailwind | Institutional operations dashboard, real-time telemetry, manual override | Browser <-> API Gateway (:3000) |

---

## 2. Event Bus (Apache Kafka) Topology

Brokers: `kafka:29092` (Docker) or `localhost:9092` (Local)

### Key Topics & Schemas

#### 1. `ai_signals`
Emitted by `ai-engine-service` (:3004), consumed by `agent-orchestrator` (:3012).
```json
{
  "symbol": "RELIANCE",
  "signal": "BUY",
  "regime": "BULL",
  "confidence": 88.5,
  "memo": "Sentiment momentum for RELIANCE is peaking. Neural-Alpha V2 predicts upward structural expansion.",
  "strategy": "MOMENTUM_ENGINE",
  "isPaper": true,
  "timestamp": "2026-09-04T13:45:00.000Z"
}
```

#### 2. `portfolio_updates`
Emitted by `portfolio-service` (:3005), consumed by `risk-management-service` (:3010) and `agent-orchestrator` (:3012).
```json
{
  "userId": "user_123",
  "cash": 4500000,
  "currency": "INR",
  "totalValue": 12500000,
  "unrealizedPnl": 34000,
  "drawdownPct": 2.4,
  "timestamp": "2026-09-04T13:45:01.000Z"
}
```

#### 3. `cfo_actions`
Emitted by `bill-payment-service` (:3016) and `liquidity-management-service` (:3015).
```json
{
  "event": "BILL_PAID_AUTONOMOUSLY",
  "billId": "a1b2c3d4-...",
  "vendor": "AWS_CLOUD_INFRA",
  "amount": "450.00",
  "currency": "USD",
  "timestamp": "2026-09-04T13:45:02.000Z"
}
```

#### 4. `market_ticks`
Emitted by `market-data-service` (:3003), consumed by `risk-management-service` and API Gateway.
```json
{
  "symbol": "TCS",
  "price": 3840.50,
  "volume": 12400,
  "bid": 3840.00,
  "ask": 3841.00,
  "timestamp": "2026-09-04T13:45:00.120Z"
}
```

---

## 3. Redis Cache Topology

Default Port: `6379`
- `price:<SYMBOL>` -> Last traded price (string or JSON float)
- `sentiment:<SYMBOL>` -> Aggregated sentiment score float (-1.0 to 1.0)
- `session:<TOKEN>` -> Auth session data
- `risk:drawdown:<USER_ID>` -> Current trailing max drawdown
- `var:portfolio:<USER_ID>` -> Calculated Value-at-Risk figure

---

## 4. PostgreSQL Data Model & Ledger Architecture

Database: `trading_platform` (dev: `trading_platform_dev`)

Key Tables:
- `users`: Core identity, risk level, password hash, preferences JSONB.
- `portfolios`: Cash balances stored in cents/paisa (`cash BIGINT`), currency, paper flag.
- `positions`: Active holdings, average buy price, current price, unrealized P&L.
- `orders`: Order execution history, idempotency keys, broker order IDs, status.
- `market_history`: TimescaleDB hypertable for OHLCV ticks.
- `ai_signals`: Historical ML inference log with confidence, targets, reasoning memos.
- `bills`: Liabilities, vendors, amounts, due dates, statuses (`PENDING`, `PAID`, `OVERDUE`).
- `liabilities`: Debts, credit cards, loans, balances, APR percentages.
- `agents`: Autonomous agent instances (`MOMENTUM`, `ARBITRAGE`), status (`HUNTING`, `EXECUTING`, `STOPPED`), allocations.
- `fleet_health`: Service heartbeat registry, latency in ms, status (`ONLINE`, `DEGRADED`, `OFFLINE`).
- `news_feed`: Ingested financial news, impact, sentiment, correlated ticker.
