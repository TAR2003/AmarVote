# 📊 Monitoring — Prometheus & Grafana

**Status:** Production only (`docker-compose.prod.yml`)  
**Prometheus Port:** `9090` · **Network IP:** `172.20.0.50` · **Memory Limit:** `256 MiB`  
**Grafana Port:** `3000` · **Network IP:** `172.20.0.60` · **Memory Limit:** `256 MiB`  
**Access:** `http://localhost:9090` (Prometheus) · `http://localhost:3000` (Grafana)

---

## Overview

AmarVote's production stack includes a Prometheus + Grafana monitoring pair for real-time observability of all services.

- **Prometheus** scrapes metrics from Spring Boot Actuator every 15 seconds
- **Grafana** provides dashboards for visualization and alerting

---

## Prometheus Configuration

**Location:** `prometheus/prometheus.yml`

```yaml
global:
  scrape_interval: 15s         # Pull metrics every 15 seconds
  evaluation_interval: 15s     # Evaluate alerting rules every 15s

scrape_configs:
  - job_name: 'spring-boot'
    metrics_path: '/actuator/prometheus'
    static_configs:
      - targets: ['172.20.0.30:8080']   # Backend container IP
```

Prometheus scrapes `http://172.20.0.30:8080/actuator/prometheus` — a Micrometer-generated endpoint that exports all application metrics in Prometheus text format.

The `/actuator/prometheus` endpoint is public (no auth required) per `SecurityConfig`.

---

## Metrics Exported by the Backend

The Spring Boot backend exports a rich set of metrics via Micrometer:

### JVM Metrics

| Metric | Description |
|---|---|
| `jvm_memory_used_bytes{area, id}` | Heap and non-heap memory usage |
| `jvm_gc_pause_seconds` | Garbage collection pause times |
| `jvm_gc_memory_promoted_bytes_total` | Bytes promoted to old generation |
| `jvm_threads_live_threads` | Active thread count |
| `jvm_buffer_memory_used_bytes` | Buffer pool usage |
| `process_cpu_usage` | JVM process CPU usage |
| `system_cpu_usage` | Host CPU usage |

### HTTP Metrics

| Metric | Description |
|---|---|
| `http_server_requests_seconds{method, status, uri}` | Request count and latency histogram |
| `http_server_requests_seconds_max` | Maximum request duration |

### HikariCP Database Pool

| Metric | Description |
|---|---|
| `hikaricp_connections_active` | In-use connections |
| `hikaricp_connections_idle` | Idle connections |
| `hikaricp_connections_pending` | Threads waiting for connection |
| `hikaricp_connections_max` | Pool maximum |
| `hikaricp_connections_timeout_total` | Connection timeout count |
| `hikaricp_connections_acquire_seconds` | Time to acquire a connection |

### RabbitMQ Metrics

| Metric | Description |
|---|---|
| `rabbitmq_published_total` | Messages published per queue |
| `rabbitmq_consumed_total` | Messages consumed per queue |
| `rabbitmq_failed_to_publish_total` | Publish failures |
| `rabbitmq_connections` | Active RabbitMQ connections |
| `rabbitmq_channels` | Active AMQP channels |

### Spring AMQP Listener Metrics

| Metric | Description |
|---|---|
| `spring_rabbitmq_listener_seconds` | Listener invocation duration |
| `spring_rabbitmq_listener_seconds_count` | Total listener invocations |

### Application Label

All metrics carry the label `application=AmarVote Backend` (configured via `management.metrics.tags.application`).

---

## Grafana Configuration

**Admin credentials:**
- Username: `admin`
- Password: `${GF_SECURITY_ADMIN_PASSWORD}` (set in `.env`)

**Additional settings:**
```yaml
GF_USERS_ALLOW_SIGN_UP: "false"          # No public sign-up
GF_SERVER_ROOT_URL: "http://localhost:3000"
```

### Recommended Dashboards

After deploying Grafana, import these standard dashboards from grafana.com:

| Dashboard ID | Name | Purpose |
|---|---|---|
| 4701 | JVM (Micrometer) | Heap, GC, threads |
| 6756 | Spring Boot Statistics | HTTP metrics, error rates |
| 10991 | RabbitMQ Overview (Prometheus) | Queue depths, message rates |
| 14046 | HikariCP Dashboard | DB connection pool |

### Key Panels to Monitor

**Memory:**
- JVM Heap Used vs. Heap Max (alert if > 80%)
- GC pause frequency and duration
- Worker task memory profile (spikes during chunk processing)

**Throughput:**
- HTTP request rate per endpoint
- RabbitMQ message publish/consume rate
- Worker processing rate (tasks/minute)

**Latency:**
- API response time percentiles (P50, P95, P99)
- DB query time (via HikariCP acquire time)
- ElectionGuard call duration

**Errors:**
- HTTP 4xx/5xx rates
- RabbitMQ connection failures
- Circuit breaker state (open/half-open/closed)

---

## Health Checks

Backend exposes Actuator health at `/actuator/health` (public):

```json
{
  "status": "UP",
  "components": {
    "db": { "status": "UP", "details": { "database": "PostgreSQL", "validationQuery": "isValid()" } },
    "diskSpace": { "status": "UP" },
    "ping": { "status": "UP" },
    "rabbit": { "status": "UP", "details": { "version": "3.13.0" } },
    "redis": { "status": "UP" }
  }
}
```

### Nginx `/health`

The Nginx reverse proxy also has a direct health response:

```nginx
location /health {
    access_log off;
    return 200 "healthy\n";
    add_header Content-Type text/plain;
}
```

---

## Alerting (Suggested Configuration)

Add these alerting rules to Prometheus (`prometheus.rules.yml`):

```yaml
groups:
  - name: amarvote_alerts
    rules:
      - alert: HighHeapUsage
        expr: jvm_memory_used_bytes{area="heap"} / jvm_memory_max_bytes{area="heap"} > 0.85
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "JVM heap usage above 85%"

      - alert: HighErrorRate
        expr: rate(http_server_requests_seconds_count{status=~"5.."}[5m]) > 0.1
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "High HTTP 5xx error rate"

      - alert: RabbitMQQueueDepth
        expr: rabbitmq_queue_messages > 1000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "RabbitMQ queue depth high — workers may be lagging"

      - alert: DBConnectionPoolExhaustion
        expr: hikaricp_connections_pending > 5
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "DB connection pool pending requests > 5"
```

---

## Docker Compose (Production)

```yaml
prometheus:
  image: prom/prometheus:latest
  volumes:
    - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
  command:
    - '--config.file=/etc/prometheus/prometheus.yml'
    - '--storage.tsdb.path=/prometheus'
    - '--web.console.libraries=/usr/share/prometheus/console_libraries'
    - '--web.console.templates=/usr/share/prometheus/consoles'
  ports:
    - "9090:9090"
  mem_limit: 256m

grafana:
  image: grafana/grafana:latest
  environment:
    - GF_SECURITY_ADMIN_PASSWORD=${GF_SECURITY_ADMIN_PASSWORD}
    - GF_USERS_ALLOW_SIGN_UP=false
    - GF_SERVER_ROOT_URL=http://localhost:3000
  volumes:
    - grafana_data:/var/lib/grafana
  ports:
    - "3000:3000"
  depends_on:
    - prometheus
  mem_limit: 256m
```
