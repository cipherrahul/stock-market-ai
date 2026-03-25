# Production Architecture & System Integration Guide

## Architecture Overview

The stock market agent platform uses a microservices architecture with comprehensive observability, automated deployment, and security policies.

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     External Users/Brokers                       │
└─────────────────┬───────────────────────────────────────────────┘
                  │ HTTPS
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NGINX Ingress Controller                      │
│                 (SSL Termination, Routing)                       │
└─────────────────┬───────────────────────────────────────────────┘
                  │
    ┌─────────────┼─────────────┐
    ▼             ▼             ▼
┌────────┐   ┌────────┐   ┌──────────┐
│ Auth   │   │ Market │   │ Portfolio│
│Service │   │ Data   │   │ Service  │
│(3001)  │   │(3003)  │   │ (3005)   │
└────┬───┘   └────┬───┘   └───┬──────┘
     │             │            │
     └─────────────┼────────────┘
                   │
             ┌─────▼────────┐
             │  API Gateway │
             │   (3000)     │
             └──────┬───────┘
                    │
         ┌──────────┼──────────┐
         ▼          ▼          ▼
    ┌────────┐ ┌────────┐ ┌──────────┐
    │Trading │ │Risk    │ │Sentiment │
    │Engine  │ │Manager │ │ Service  │
    │(3006)  │ │(3010)  │ │ (3011)   │
    └────────┘ └────────┘ └──────────┘
         │
         ▼
    ┌──────────────┐
    │  Kafka Event │
    │   Bus        │
    └──────┬───────┘
           │
    ┌──────▼──────────┐
    │ Redis Cache &   │
    │ Session Store   │
    └────────┬────────┘
             │
             ▼
    ┌──────────────────┐
    │  PostgreSQL DB   │
    │  (Metrics, Data) │
    └──────────────────┘

Observability Layer:
┌─────────────────────────────────────────────────────────────────┐
│  Prometheus (Metrics) ◄─ Service Exporters (JMX, StatsD, etc.) │
└──────────┬────────────────────────────────────────────────────┘
           │
           ├─► Grafana (4 Dashboards)
           │    ├─ Service Metrics
           │    ├─ Database Metrics
           │    ├─ Infrastructure Metrics
           │    └─ Trading Metrics
           │
           ├─► AlertManager
           │    └─► Slack Notifications
           │
           └─► Elasticsearch/Kibana
                └─ Structured Logs (JSON)

Security Layer:
┌─────────────────────────────────────────────────────────────────┐
│  Kubernetes RBAC (Service Accounts, Roles, Bindings)            │
│  Network Policies (Default-Deny + Selective Allow)              │
│  Pod Security Policies (Restricted Mode)                        │
│  Secrets Management (JWT Keys, DB Credentials, API Keys)        │
└─────────────────────────────────────────────────────────────────┘

CI/CD Pipeline:
┌─────────────────────────────────────────────────────────────────┐
│ GitHub Actions (2 Workflows)                                    │
│                                                                  │
│ test-and-quality.yml:                                          │
│  Lint (ESLint) ► Test (Jest) ► Security (npm audit) ►          │
│  Integration ► Build (Docker) ► Deploy-Staging                 │
│                                                                  │
│ build-and-deploy.yml:                                          │
│  Multi-image Build ► Staging Deploy ► Wait for Approval ►      │
│  Blue-Green Switch ► Health Checks ► Rollback (if needed)      │
└─────────────────────────────────────────────────────────────────┘
```

## Component Interactions

### Authentication Flow

```
User Request
    │
    ▼
API Gateway (HTTPS + Rate Limiting)
    │
    ▼
Auth Service (JWT Verification)
    │
    ├─ Valid Token?
    │  ├─ Yes ─► Extract claims (user_id, role)
    │  │         └─► Request Logger (Correlation ID)
    │  │             └─► Route to service
    │  │
    │  └─ No ─► 401 Unauthorized response
    │
    ▼
Service Handler (RBAC Check)
    │
    ├─ User has permission?
    │  ├─ Yes ─► Execute business logic + Audit Log
    │  │         └─► Return response
    │  │
    │  └─ No ─► 403 Forbidden response
    │
    ▼
Logger (JSON structured log + Correlation ID)
    │
    ├─► Console Output (development)
    ├─► Daily Rotating File (production)
    └─► Elasticsearch (via Logstash)
```

### Trade Execution Flow

```
POST /api/trading/execute
    │
    ▼
API Gateway
    │
    ├─ Rate limit check
    ├─ Authentication
    ├─ Input validation (Joi schemas)
    │
    ▼
Trading Engine Service
    │
    ├─ Risk validation
    │  ├─ Position limits (Max 10% per symbol)
    │  ├─ Daily loss limit (Max -5%)
    │  ├─ Correlation check
    │
    ▼
Order execution
    │
    ├─ Check broker availability
    ├─ Calculate slippage
    ├─ Execute trade via Broker Service
    │
    ▼
Event publication to Kafka
    │
    ├─► Portfolio Service (Update holdings)
    ├─► Risk Manager (Update metrics)
    ├─► Notification Service (Send alerts)
    │
    ▼
Redis cache update
    │
    ▼
Database transaction
    │
    ├─ Insert order record
    ├─ Update portfolio
    ├─ Update user metrics
    │
    ▼
Audit log (Auth event + Trade event)
    │
    ▼
Prometheus metrics
    │
    ├─ trading_orders_executed_total (counter)
    ├─ trading_volume_total (gauge)
    ├─ http_request_duration_seconds (histogram)
    │
    ▼
Return response (200 OK)
    │
    ├─ Order ID
    ├─ Execution price
    ├─ Timestamp
    ├─ Status
```

### Data Flow (Batch Operations)

```
Scheduled Job (every 5 minutes)
    │
    ▼
Market Data Service
    │
    ├─ Fetch quotes from broker APIs
    ├─ Cache in Redis (1hr TTL)
    ├─ Store candles in PostgreSQL
    │
    ▼
AI Engine Service (Python)
    │
    └─ Load ML model
       ├─ Process OHLCV data
       ├─ Generate predictions
       ├─ Score symbols (1-100)
    │
    ▼
Sentiment Service
    │
    └─ Fetch news/social media
       ├─ NLP analysis
       ├─ Generate sentiment scores
    │
    ▼
Portfolio Service
    │
    └─ Recalculate portfolio metrics
       ├─ Update nav (net asset value)
       ├─ Calculate day gains/losses
       ├─ Update allocations
    │
    ▼
Risk Manager
    │
    └─ Evaluate portfolio risk
       ├─ Check VaR (Value at Risk)
       ├─ Recalculate correlations
       ├─ Generate alerts if thresholds exceeded
    │
    ▼
Database writes
    │
    └─ Upsert all metrics to PostgreSQL
    │
    ▼
Prometheus scrape
    │
    └─ Collect service metrics
       ├─ Processing duration
       ├─ Data freshness
       ├─ Error rates
    │
    ▼
Grafana visualizations updated
```

## Deployment Topology

### Blue-Green Deployment

```
Time T+0: Blue (Current Production)
┌──────────────────────────────────────┐
│  Namespace: stockmarket-prod-blue    │
├──────────────────────────────────────┤
│ Replicas:            3               │
│ Auth Service         Running ✅      │
│ Portfolio Service    Running ✅      │
│ Trading Engine       Running ✅      │
│ API Gateway          Running ✅      │
│ Database             Shared          │
│ Cache (Redis)        Shared          │
│ Ingress Points To: api-gateway-blue │
└──────────────────────────────────────┘

Time T+30min: Green (New Version Deployment)
┌──────────────────────────────────────┐
│  Namespace: stockmarket-prod-green   │
├──────────────────────────────────────┤
│ Replicas:            3               │
│ Auth Service         Running ✅      │
│ Portfolio Service    Running ✅      │
│ Trading Engine       Running ✅      │
│ API Gateway          Running ✅      │
│ Database             Shared          │
│ Cache (Redis)        Shared          │
│ Ingress Points To: (still blue)     │
└──────────────────────────────────────┘

Time T+45min: Smoke Tests Pass, Start Traffic Switch
┌──────────────────────────────────────┐
│  Traffic Distribution:               │
│  Blue  (Old): 100%                  │
│  Green (New): 0%                    │
│  (Switch begins)                     │
└──────────────────────────────────────┘

Time T+60min: Full Switchover
┌──────────────────────────────────────┐
│  Traffic Distribution:               │
│  Blue  (Old): 0%                    │
│  Green (New): 100%                  │
│  Ingress Points To: api-gateway-grn │
└──────────────────────────────────────┘

Time T+120min+: Blue Decommissioned
┌──────────────────────────────────────┐
│  Namespace: stockmarket-prod-blue    │
│  Status: DELETED                    │
│  Namespace: stockmarket-prod-green   │
│  Status: LIVE (renamed to prod)     │
└──────────────────────────────────────┘
```

## High Availability Architecture

### Replica Distribution

```
Node 1 (zone-a)
├─ auth-service pod 1
├─ portfolio-service pod 1
├─ trading-engine pod 1

Node 2 (zone-b)
├─ auth-service pod 2
├─ portfolio-service pod 2
├─ trading-engine pod 2

Node 3 (zone-c)
├─ auth-service pod 3
├─ portfolio-service pod 3
├─ trading-engine pod 3

Monitoring (3 replicas across zones)
├─ Prometheus pod 1 (zone-a)
├─ Prometheus pod 2 (zone-b)
├─ Grafana pod 1 (zone-c)
└─ Grafana pod 2 (zone-a)
```

### Load Distribution

```
External Traffic
    │
    ▼
Load Balancer (AWS/GCP/Azure)
    │
    ├─► NGINX Ingress Controller (pod 1)
    ├─► NGINX Ingress Controller (pod 2)
    └─► NGINX Ingress Controller (pod 3)
        │
        ▼
    Service (api-gateway)
        │
        ├─► api-gateway pod 1 (connection 1)
        ├─► api-gateway pod 2 (connection 2)
        └─► api-gateway pod 3 (connection 3)
            │
            └─► Based on service routing:
                ├─► auth-service (RoundRobin)
                ├─► portfolio-service (RoundRobin)
                └─► trading-engine (RoundRobin)
```

## Monitoring Stack Integration

### Metrics Collection Pipeline

```
Application Pods (Exporters)
    │
    ├─ Service metrics (prom-client)
    │  ├─ HTTP requests (total, errors, duration)
    │  ├─ Business metrics (trades, orders)
    │  ├─ Custom gauges (portfolio value, risk)
    │
    ├─ Database metrics (PostgreSQL exporter)
    │  ├─ Connection pool status
    │  ├─ Query latency
    │  ├─ Slow queries
    │
    ├─ Infrastructure metrics (kubelet)
    │  ├─ CPU usage
    │  ├─ Memory usage
    │  ├─ Network I/O
    │
    └─ Kubernetes metrics (kube-state-metrics)
       ├─ Pod status
       ├─ Deployment status
       ├─ Node status
    │
    ▼
Prometheus (Scrape interval: 15 seconds)
    │
    ├─ Store in local time-series database (15-day retention)
    │
    ├─ Execute queries every 30 seconds
    │  ├─ Alert rules (7 rules → AlertManager if triggered)
    │  └─ Recording rules (6 rules → pre-computed metrics)
    │
    ▼
AlertManager (Rule evaluation)
    │
    ├─ Check alert conditions
    ├─ Cluster similar alerts
    ├─ Send notifications:
    │  ├─ Slack channel (#alerts)
    │  ├─ PagerDuty (critical only)
    │  └─ SMS (critical + ack timeout)
    │
    ▼
Grafana (Dashboard rendering)
    │
    ├─ Query Prometheus every 30 seconds
    ├─ Render 4 dashboards:
    │  ├─ Service Metrics (HTTP rates, errors, latency)
    │  ├─ Database Metrics (connections, queries, cache)
    │  ├─ Infrastructure (CPU, memory, disk)
    │  └─ Trading Metrics (orders, volume, profitability)
    │
    ▼
Browser (Real-time visualization)
    │
    └─ Grafana UI (https://grafana.stockmarketagent.com)
```

### Logging Pipeline

```
Application Pods (Winston logger)
    │
    ├─ Write to stdout (JSON format)
    ├─ Write to daily rotating file
    │  ├─ logs/%DATE%.log (30-day retention)
    │  └─ logs/errors/%DATE%-error.log (90-day retention)
    │
    ▼
Container Logs (Kubernetes)
    │
    ├─ kubectl logs <pod-name>
    │
    ▼
Log Collection (Filebeat / Fluentd)
    │
    ├─ Read from container logs
    ├─ Parse JSON format
    ├─ Add metadata (pod name, namespace, node)
    │
    ▼
Elasticsearch
    │
    ├─ Index by date: logs-2024-01-15
    ├─ Store with 30-day retention
    │
    ▼
Kibana (Search and Analysis)
    │
    ├─ Query Elasticsearch
    ├─ Create visualizations
    ├─ Search by:
    │  ├─ Correlation ID (trace request across services)
    │  ├─ Service name
    │  ├─ Log level (ERROR, WARN, INFO)
    │  ├─ Time range
    │  └─ Free text search
    │
    ▼
Browser (https://kibana.stockmarketagent.com)
```

## Disaster Recovery Architecture

### Backup Strategy

```
Daily Schedule:
┌──────────────────────────────────────────────────────┐
│ 02:00 UTC: PostgreSQL Full Backup                   │
│  ├─ Location: AWS S3 (encrypted)                    │
│  ├─ Retention: 30 days                              │
│  ├─ Verification: Restore test daily               │
│
│ 04:00 UTC: Redis RDB Snapshot                       │
│  ├─ Location: AWS S3 (encrypted)                    │
│  ├─ Retention: 7 days                               │
│  └─ Verification: Can restore to new instance     │
│
│ 23:59 UTC: Configuration Files Backup               │
│  ├─ Location: Git repository + S3                   │
│  ├─ Items: K8s manifests, Prometheus config        │
│  └─ Retention: Infinite (Git history)              │
└──────────────────────────────────────────────────────┘

Recovery Procedures:
├─ RTO (Recovery Time Objective): 15 minutes
├─ RPO (Recovery Point Objective): 1 hour
├─ Test: Full restore test weekly from backup
└─ Runbook: /docs/disaster-recovery.md
```

### Failover Strategy

```
Database Failover (PostgreSQL):
├─ Primary (Replica 1)
├─ Standby (Replica 2)
│  └─ Continuous replication via WAL shipping
│
└─ On Primary Failure:
   ├─ Patroni promotion (automatic)
   ├─ Standby becomes Primary
   ├─ New Standby provisioned
   ├─ Alert: PagerDuty
   └─ RTO: <1 minute

Service Failover (Kubernetes):
├─ Pod crash → Kubelet restarts (RTO: 10-30s)
├─ Node failure → Pods reschedule to other node (RTO: 1-2min)
├─ Zone outage → Pods reschedule from zone replicas (RTO: 1-3min)
│
└─ Minimum replica count: 2 (spread across zones)
```

## Compliance & Audit Trail

### Audit Logging

```
All Auditable Events:

Authentication:
├─ Login attempt (success/failure)
├─ Logout
├─ Token refresh
└─ Session creation/termination
   │
   └─ Log entry: {user_id, timestamp, status, ip_address, user_agent}

Trading:
├─ Order creation
├─ Order execution
├─ Order cancellation
└─ Trade settlement
   │
   └─ Log entry: {user_id, order_id, symbol, quantity, price, timestamp}

Portfolio Modifications:
├─ Holdings update
├─ Rebalancing
└─ Settings change
   │
   └─ Log entry: {user_id, change_type, before, after, timestamp}

Data Access:
├─ Portfolio view
├─ Trade history view
└─ Report generation
   │
   └─ Log entry: {user_id, resource, timestamp, ip_address}

System:
├─ Configuration changes
├─ Key rotations
├─ Security policy updates
   │
   └─ Log entry: {admin_id, change_type, details, timestamp}

Retention:
├─ Authentication: 1 year
├─ Trading: 7 years (regulatory requirement)
├─ Data Access: 1 year
└─ System: 2 years (compliance & debugging)
```

---

## Performance Targets

### Service Level Indicators (SLI)

```
Metric                 Target    Alert Threshold
─────────────────────────────────────────────────
API Latency (P95)      <100ms    >500ms
API Latency (P99)      <200ms    >1000ms
Error Rate             <0.1%     >0.5%
Availability           99.95%    <99.9%
Database Latency       <50ms     >200ms
Cache Hit Ratio        >90%      <80%
```

### Capacity Planning

```
Current Load:
├─ Requests/sec: ~100
├─ Concurrent Users: ~500
├─ Database Connections: 20-30
├─ Cache Entries: 10K+

Planned Growth (Year 1):
├─ Requests/sec: ~500 (5x growth)
├─ Concurrent Users: ~2500 (5x growth)
├─ Database Connections: 50-100
├─ Cache Entries: 100K+

Scaling Strategy:
├─ Horizontal: Add pod replicas automatically via HPA
├─ Vertical: Increase resource requests/limits
├─ Database: Read replicas + connection pooling
├─ Cache: Redis cluster with sharding
```

---

**Last Updated**: March 25, 2026  
**Reviewed By**: Platform Engineering Team  
**Next Architecture Review**: September 25, 2026
