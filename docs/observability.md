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

## Endpoints
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3000`
- Zipkin: `http://localhost:9411`

## Prometheus config
- Scrape config: `infrastructure/prometheus/prometheus.yml`
- Alert rules: `observability/prometheus/alert-rules.yml`
