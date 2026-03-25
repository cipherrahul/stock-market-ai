# Monitoring & Observability Guide

## Overview

The stock market agent platform uses a comprehensive monitoring and observability stack to ensure high availability, performance, and quick incident resolution.

**Stack**:
- **Metrics**: Prometheus (collection) + Grafana (visualization)
- **Logs**: ELK Stack (Elasticsearch, Logstash, Kibana)
- **Traces**: Jaeger (distributed tracing)
- **Alerts**: AlertManager + Slack/PagerDuty notifications

## 1. Metrics Collection (Prometheus)

### Key Metrics to Track

#### Application Metrics
```promql
# HTTP Request Rate
rate(http_requests_total[5m])

# Error Rate
rate(http_requests_total{status=~"5.."}[5m])

# Latency (P95)
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Active Requests
http_requests_in_progress
```

#### Business Metrics
```promql
# Orders executed
increase(trading_orders_executed_total[24h])

# Trading volume
sum(increase(trading_volume_total[24h]))

# Success rate
(orders_executed / orders_total) * 100

# Average trade value
orders_total_value / orders_executed_count
```

#### Infrastructure Metrics
```promql
# CPU usage
rate(container_cpu_usage_seconds_total[5m])

# Memory usage
container_memory_usage_bytes / container_spec_memory_limit_bytes

# Disk I/O
rate(node_disk_io_reads_total[5m])

# Network I/O
rate(node_network_transmit_bytes_total[5m])
```

### Prometheus Setup

```bash
# Install via Helm
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/prometheus \
  --namespace monitoring \
  --values infra/kubernetes/monitoring/prometheus-values.yaml
```

### Custom Metrics Implementation

```typescript
import prometheus from 'prom-client';

// Create custom metrics
const httpDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5],
});

const ordersExecuted = new prometheus.Counter({
  name: 'trading_orders_executed_total',
  help: 'Total orders executed',
  labelNames: ['symbol', 'type'],
});

// Middleware to track requests
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpDuration
      .labels(req.method, req.route?.path || req.path, res.statusCode)
      .observe(duration);
  });
  next();
});

// Track business events
const recordTrade = (symbol: string, type: string) => {
  ordersExecuted.labels(symbol, type).inc();
};

// Expose metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', prometheus.register.contentType);
  res.end(await prometheus.register.metrics());
});
```

## 2. Visualization (Grafana)

### Dashboard Types

#### Service Dashboard
```
Shows: Request rate, error rate, latency, active connections
Update frequency: 30 seconds
Retention: 6 hours
Target users: On-call engineers, developers
```

#### Database Dashboard
```
Shows: Connection pool, query rate, slow queries, cache hit ratio
Update frequency: 1 minute
Retention: 24 hours
Target users: Database admins, DevOps
```

#### Business Dashboard
```
Shows: Orders/day, trading volume, success rate, top symbols
Update frequency: 5 minutes
Retention: 90 days
Target users: Product, Finance, Leadership
```

#### Infrastructure Dashboard
```
Shows: Node CPU/Memory, disk usage, network I/O
Update frequency: 1 minute
Retention: 7 days
Target users: DevOps, Platform engineers
```

### Accessing Grafana

```
URL: https://grafana.stockmarketagent.com
Default Credentials:
 - Username: admin
 - Password: ${GRAFANA_PASSWORD}

Change password on first login!
```

### Creating Custom Dashboards

```bash
# Via API
curl -X POST https://grafana.stockmarketagent.com/api/dashboards/db \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d @dashboard-config.json

# Via UI: Dashboard -> Create -> Choose visualization
```

## 3. Centralized Logging (ELK Stack)

### Log Structure

All logs are JSON-formatted:

```json
{
  "timestamp": "2024-01-15T14:23:45Z",
  "level": "INFO",
  "service": "auth-service",
  "environment": "production",
  "correlationId": "1705338225-8b9f2e1",
  "userId": "user-123",
  "path": "/api/auth/login",
  "method": "POST",
  "statusCode": 200,
  "duration": 145,
  "message": "User login successful"
}
```

### Elasticsearch Configuration

```yaml
# infra/docker-compose/elasticsearch.yml
elasticsearch:
  image: docker.elastic.co/elasticsearch/elasticsearch:8.5.0
  environment:
    - discovery.type=single-node
    - xpack.security.enabled=true
    - ELASTIC_PASSWORD=$ELK_PASSWORD
  volumes:
    - elasticsearch-data:/usr/share/elasticsearch/data
  ports:
    - "9200:9200"
```

### Kibana Queries

```json
// Find all errors for service
{
  "query": {
    "bool": {
      "must": [
        { "match": { "level": "ERROR" } },
        { "match": { "service": "auth-service" } }
      ]
    }
  }
}

// Trace request by correlation ID
{
  "query": {
    "match": { "correlationId": "1705338225-8b9f2e1" }
  }
}

// Find slow requests
{
  "query": {
    "range": { "duration": { "gte": 1000 } }
  }
}

// Database errors with context
{
  "query": {
    "bool": {
      "must": [
        { "match": { "level": "ERROR" } },
        { "match": { "message": "*database*" } }
      ]
    }
  }
}
```

### Accessing Kibana

```
URL: https://kibana.stockmarketagent.com
Credentials: Same as Elasticsearch
```

## 4. Distributed Tracing (Jaeger)

### Trace Propagation

```typescript
import opentelemetry from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';

const jaegerExporter = new JaegerExporter({
  host: process.env.JAEGER_HOST,
  port: parseInt(process.env.JAEGER_PORT!),
});

const tracerProvider = new NodeTracerProvider();
tracerProvider.addSpanProcessor(new jaegerExporter);

opentelemetry.trace.setGlobalTracerProvider(tracerProvider);

// Create spans
const tracer = opentelemetry.trace.getTracer('auth-service');

const span = tracer.startSpan('user_login', {
  attributes: {
    'user.id': userId,
    'http.method': 'POST',
    'http.url': req.url,
  },
});

try {
  // Do work
} finally {
  span.end();
}
```

### Jaeger UI

```
URL: https://jaeger.stockmarketagent.com
Features:
- Search traces by service, operation, tags
- View trace timeline
- Identify bottlenecks
- Analyze error traces
```

## 5. Alerting

### Alert Rules

```promql
# High error rate
alert: HighErrorRate
expr: (sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))) > 0.05
for: 5m
severity: warning
```

```promql
# Service unavailable
alert: ServiceDown
expr: up{job=~"auth-service|portfolio-service"} == 0
for: 2m
severity: critical
```

```promql
# High latency
alert: HighLatency
expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
for: 5m
severity: warning
```

### Alert Routing

```yaml
# alertmanager.yml
global:
  slack_api_url: $SLACK_WEBHOOK_URL

route:
  receiver: 'pagerduty'
  group_by: ['alertname', 'cluster']
  routes:
    - match:
        severity: critical
      receiver: 'pagerduty'
      continue: true
    - match:
        severity: warning
      receiver: 'slack'

receivers:
  - name: slack
    slack_configs:
      - channel: '#alerts'
        title: '{{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
  
  - name: pagerduty
    pagerduty_configs:
      - service_key: $PAGERDUTY_SERVICE_KEY
        description: '{{ .GroupLabels.alertname }}'
```

## 6. SLOs & SLIs

### Definition

```
SLI (Service Level Indicator): Metric measuring service behavior
- Error rate < 0.1%
- P99 latency < 500ms
- Availability > 99.95%

SLO (Service Level Objective): Target for SLI
- Error rate SLI <= 0.05%
- P99 latency SLI <= 200ms
- Availability SLO >= 99.9%

Error budget = (1 - SLO) = 0.1% = 43 minutes per month
```

### SLO Implementation

```promql
# Error rate SLI
(
  sum(rate(http_requests_total{status=~"5.."}[5m]))
  /
  sum(rate(http_requests_total[5m]))
)

# Latency SLI (P99)
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))

# Uptime SLI
up{job=~"auth-service|portfolio-service"}

# Good requests
sum(rate(http_requests_total{status=~"2.."}[5m]))
```

### Monitoring SLO Compliance

```bash
# Check monthly error budget remaining
remaining_budget = (SLO * seconds_in_month - actual_errors)
if remaining_budget < budget_threshold:
  - Stop deploying new features
  - Focus on reliability
  - Incident response
```

## 7. Performance Monitoring

### Application Performance

```
Metric          | Target | Alert if
Latency (P95)   | <100ms | >500ms
Error Rate      | <0.1%  | >1%
Throughput      | >1000  | <500
               rps      | rps
```

### Database Performance

```
Queries/sec     | <1000  | >2000
Connections     | 70%    | >90%
Cache hit ratio | >90%   | <80%
Slow queries    | <5/min | >10/min
(>1s)
```

### Generate Load Test Report

```bash
npm run test:load

# Creates report with:
- Response time distribution
- Throughput metrics
- Error rates
- Resource utilization
```

## 8. Incident Response Workflow

### On-Call Rotation

```
Week 1: Engineer A
Week 2: Engineer B
Week 3: Engineer C
Week 4: Engineer A (rotation)

Must acknowledge PagerDuty alerts within 5 minutes
```

### Escalation

```
L1 (30 min): On-call engineer
L2 (15 min): Team lead + on-call engineer
L3 (5 min):  Engineering manager + team lead
```

### Incident Timeline

```
T+0: Alert triggered
T+5: On-call acknowledges
T+10: Initial assessment
T+15: Root cause identified
T+30: Fix deployed to staging
T+45: Fix deployed to production
T+50: Monitoring confirms resolution
```

## 9. Best Practices

### Metrics
- ✅ Always include labels (service, env, severity)
- ✅ Use consistent naming (snake_case)
- ✅ Aggregate at collection, not query time
- ❌ Don't create unbounded cardinality metrics

### Dashboards
- ✅ Use red/yellow/green status indicators
- ✅ Include runbooks for alerts
- ✅ Update regularly with new metrics
- ❌ Don't overcrowd single dashboard

### Alerts
- ✅ All alerts must be actionable
- ✅ Include specific thresholds
- ✅ Document resolution steps
- ❌ Don't alert on every spike

### Logging
- ✅ Log at appropriate levels (info, warn, error)
- ✅ Include correlation IDs
- ✅ Don't log sensitive data (passwords, keys)
- ✅ Use structured JSON format

## Contact & Escalation

- **On-Call**: PagerDuty (escalation policy configured)
- **#incidents**: Slack channel for incident coordination
- **Runbooks**: https://wiki.stockmarketagent.com/runbooks
- **Status Page**: https://status.stockmarketagent.com

---

**Last Updated**: March 25, 2026
**Maintained By**: Platform Engineering Team
