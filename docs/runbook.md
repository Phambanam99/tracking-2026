# Runbook

## Startup order
1. Core dependencies: PostgreSQL/TimescaleDB, Redis, Kafka/Zookeeper.
2. `service-auth` để phát JWKS, login, internal verify APIs.
3. Internal pipeline services: `service-ingestion`, `service-processing`, `service-storage`, `service-broadcaster`.
4. `service-gateway` sau khi downstream đã healthy để tránh public 5xx lúc boot.
5. Frontend/UI sau cùng.

## Bring up/down infra

### Core dependencies
```bash
docker compose -f infrastructure/docker-compose.yml --env-file infrastructure/.env.example up -d
./infrastructure/kafka/create-topics.sh
```

### Observability stack
```bash
docker compose -f infrastructure/docker-compose-observability.yml --env-file infrastructure/.env.example up -d
```

Nếu stack app chạy trong Docker và expose host ports `18080-18085`, render lại Prometheus targets:
```bash
SERVICE_GATEWAY_METRICS_TARGET=host.docker.internal:18080 \
SERVICE_AUTH_METRICS_TARGET=host.docker.internal:18081 \
SERVICE_INGESTION_METRICS_TARGET=host.docker.internal:18082 \
SERVICE_BROADCASTER_METRICS_TARGET=host.docker.internal:18083 \
SERVICE_STORAGE_METRICS_TARGET=host.docker.internal:18084 \
SERVICE_PROCESSING_METRICS_TARGET=host.docker.internal:18085 \
docker compose -f infrastructure/docker-compose-observability.yml --env-file infrastructure/.env.example up -d
```

### Shutdown
```bash
docker compose -f infrastructure/docker-compose.yml down
docker compose -f infrastructure/docker-compose-observability.yml down
```

## Local service run

Start services with `local` profile:

```bash
./gradlew :service-auth:bootRun --args='--spring.profiles.active=local'
./gradlew :service-ingestion:bootRun --args='--spring.profiles.active=local'
./gradlew :service-processing:bootRun --args='--spring.profiles.active=local'
./gradlew :service-storage:bootRun --args='--spring.profiles.active=local'
./gradlew :service-broadcaster:bootRun --args='--spring.profiles.active=local'
./gradlew :service-gateway:bootRun --args='--spring.profiles.active=local'
```

Default local ports:
- `service-gateway`: `8080`
- `service-auth`: `8081`
- `service-ingestion`: `8082`
- `service-broadcaster`: `8083`
- `service-storage`: `8084`
- `service-processing`: `8085`
- `frontend-ui`: `5173`

Notes:
- `service-auth` local profile enables Flyway baseline on legacy schema (`baseline-version=5`) so DB cũ không có `flyway_schema_history` vẫn migrate được lên `V6/V7`.
- Shared local internal key default: `tracking-internal-key-2026`.

If local DB còn `flyway_schema_history` lỗi dở dang:

```bash
docker exec tracking-postgres psql -U tracking -d tracking -c "DROP TABLE IF EXISTS flyway_schema_history;"
```

## Health verification

### Infra
```bash
docker ps --format 'table {{.Names}}\t{{.Status}}'
```

### Services
```bash
curl -fsS http://localhost:8081/actuator/health
curl -fsS http://localhost:8082/actuator/health
curl -fsS http://localhost:8083/actuator/health
curl -fsS http://localhost:8084/actuator/health
curl -fsS http://localhost:8085/actuator/health
curl -fsS http://localhost:8080/api/v1/auth/.well-known/jwks.json
```

### Smoke flow
1. Register/login through gateway.
2. Create API key from auth.
3. POST batch ingest to `/api/v1/ingest/adsb/batch`.
4. Verify `live-adsb` / `historical-adsb` topic traffic, storage insert and WebSocket push.

## Logs and observability

### Docker logs
```bash
docker logs tracking-postgres --tail 200
docker logs tracking-kafka --tail 200
docker logs tracking-prometheus --tail 200
```

### Kubernetes logs
```bash
kubectl logs -n tracking deploy/tracking-gateway --tail=200
kubectl logs -n tracking deploy/tracking-ingestion --tail=200
kubectl logs -n tracking deploy/tracking-storage --tail=200
```

### Dashboard links
- Grafana: `http://localhost:3000`
- Prometheus: `http://localhost:9090`
- Zipkin: `http://localhost:9411`
- Primary dashboard: `Tracking Runtime Overview`

### Metrics cheat sheet
- Gateway:
  - `http_server_requests_seconds`
  - `resilience4j_circuitbreaker_state`
- Ingestion:
  - `tracking_ingestion_accepted_batch_records_total`
  - `tracking_ingestion_rejected_producer_unavailable_total`
- Processing:
  - `tracking_processing_pipeline_latency_seconds`
  - `tracking_processing_published_dlq_total`
- Storage:
  - `tracking_storage_batch_latency_seconds`
  - `tracking_storage_buffer_size`
- Broadcaster:
  - `ws_sessions_active`
  - `ws_sessions_rejected_jwt_total`

## Rollback procedure

### Helm / Kubernetes
```bash
helm history tracking -n tracking
helm rollback tracking <REVISION> -n tracking
kubectl rollout status deployment/tracking-gateway -n tracking
```

### Docker/local image rollback
1. Stop the failing service.
2. Switch image tag or checkout previous known-good commit.
3. Restart only the affected service.
4. Re-run health verification and smoke flow.

## Service-specific troubleshooting

### Auth
- Symptom: login fails or gateway JWT verify starts returning `401`.
- Checks:
  1. `curl -fsS http://localhost:8081/api/v1/auth/.well-known/jwks.json`
  2. Verify Flyway completed and `jwt_signing_keys` table has active keys.
  3. Check `auth-revocation` topic if revoke storm is happening.

### Gateway
- Symptom: `401/403/413/429/5xx` spike.
- Checks:
  1. Validate route config for `/api/v1/auth/**`, `/api/v1/ingest/**`, `/ws/live/**`.
  2. Inspect Redis rate-limit availability.
  3. Check circuit breaker state and downstream health.

### Ingestion
- Symptom: `429` or `503` spike.
- Checks:
  1. Inspect `tracking_ingestion_rejected_admission_total`.
  2. Inspect producer timeout metrics and Kafka broker health.
  3. Verify API key revocation cache is not stale.

### Processing
- Symptom: `invalid-telemetry-dlq` spike or live topic lag.
- Checks:
  1. Inspect `tracking_processing_published_dlq_total`.
  2. Review kinematic reject rate.
  3. Check reference data cache refresh and Planespotters timeout behavior.

### Storage
- Symptom: rows missing, batch fail, or lag growing.
- Checks:
  1. Inspect `tracking_storage_batch_failed_total`.
  2. Inspect `tracking_storage_buffer_size`.
  3. Verify Timescale hypertable/indexes and disk space.

### Broadcaster
- Symptom: browser map stops updating.
- Checks:
  1. Inspect `ws_sessions_active` and `ws_sessions_rejected_jwt_total`.
  2. Verify `historical` events are not routed to realtime push.
  3. Inspect viewport filter and Kafka consumer lag on `live-adsb`.

## Common incidents

### Kafka backlog tăng cao
1. Check consumer lag by topic/group.
2. Scale `service-processing` or `service-storage`.
3. Check DB write throughput and `tracking_storage_buffer_size`.

### WebSocket push chậm
1. Check active session count and JWT reject rate.
2. Check viewport filter selectivity.
3. Check lag on `live-adsb`.

### Rolling update `service-ingestion`
1. Keep `terminationGracePeriodSeconds >= 30`.
2. Do not rely on `preStop` shell for distroless images.
3. `IngestionShutdownHook` flushes Kafka producer before termination.
4. Watch `tracking_ingestion_kafka_published_total` and `KAFKA_PRODUCER_UNAVAILABLE`.
