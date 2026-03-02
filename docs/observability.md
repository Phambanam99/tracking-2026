# Observability

## Components
- Metrics: Prometheus
- Dashboard: Grafana
- Tracing: OpenTelemetry Collector + Zipkin
- Logging: structured JSON logs, correlation id, không log dữ liệu nhạy cảm

## Startup
```bash
docker compose -f infrastructure/docker-compose-observability.yml --env-file infrastructure/.env.example up -d
```

Nếu app stack publish metrics trên cổng khác mặc định `8080-8085`:
```bash
SERVICE_GATEWAY_METRICS_TARGET=host.docker.internal:18080 \
SERVICE_AUTH_METRICS_TARGET=host.docker.internal:18081 \
SERVICE_INGESTION_METRICS_TARGET=host.docker.internal:18082 \
SERVICE_BROADCASTER_METRICS_TARGET=host.docker.internal:18083 \
SERVICE_STORAGE_METRICS_TARGET=host.docker.internal:18084 \
SERVICE_PROCESSING_METRICS_TARGET=host.docker.internal:18085 \
docker compose -f infrastructure/docker-compose-observability.yml --env-file infrastructure/.env.example up -d
```

## Endpoints
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3000`
- Zipkin: `http://localhost:9411`

## Local service ports
- `service-gateway`: `8080`
- `service-auth`: `8081`
- `service-ingestion`: `8082`
- `service-broadcaster`: `8083`
- `service-storage`: `8084`
- `service-processing`: `8085`

## Metrics endpoints
- Tất cả service expose `GET /actuator/prometheus`
- HTTP services bật histogram cho `http.server.requests`
- Processing/Storage/Broadcaster bật histogram cho timer nội bộ để vẽ p95/p99 thực tế

## Prometheus assets
- Scrape config: `infrastructure/prometheus/prometheus.yml`
- Render helper: `infrastructure/prometheus/render-prometheus-config.sh`
- Alert rules: `observability/prometheus/alert-rules.yml`
- Dashboard seed: `observability/grafana/ingestion-latency-dashboard.json`

## Alert coverage
- Service down: mọi service `service-*`
- Gateway 5xx ratio
- Ingestion p95 latency và producer unavailable spike
- Processing DLQ spike
- Storage batch failure và buffer backpressure
- Broadcaster JWT reject spike

## Trace baseline
- Gateway sinh `x-request-id` và `traceparent` nếu request chưa có.
- Ingestion inject 2 header này vào Kafka headers.
- Processing/Storage/Broadcaster đọc lại Kafka headers để giữ trace context xuyên chuỗi service.
- OTEL Collector nhận OTLP qua `4317/4318`, apply `memory_limiter + batch`, export sang Zipkin.

## Quick verification
```bash
curl -fsS http://localhost:8080/actuator/prometheus >/dev/null
curl -fsS http://localhost:8082/actuator/prometheus | rg "tracking_ingestion"
curl -fsS http://localhost:8085/actuator/prometheus | rg "tracking_processing"
curl -fsS http://localhost:8084/actuator/prometheus | rg "tracking_storage"
curl -fsS http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job: .labels.job, health: .health}'
```
