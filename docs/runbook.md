# Runbook

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

### Shutdown
```bash
docker compose -f infrastructure/docker-compose.yml down
docker compose -f infrastructure/docker-compose-observability.yml down
```

## Local service run (no manual env)

Start infra first, then run services with `local` profile:

```bash
./gradlew :service-auth:bootRun --args='--spring.profiles.active=local'
./gradlew :service-ingestion:bootRun --args='--spring.profiles.active=local'
./gradlew :service-gateway:bootRun --args='--spring.profiles.active=local'
```

Default local ports:
- `service-auth`: `8081`
- `service-ingestion`: `8082`
- `service-gateway`: `8080`

Notes:
- `service-auth` local profile enables Flyway baseline on legacy schema (`baseline-version=5`) so DB cũ không có `flyway_schema_history` vẫn migrate được lên `V6/V7`.
- Shared local internal key default: `tracking-internal-key-2026`.

If bạn đã từng chạy bản cũ và có `flyway_schema_history` lỗi dở dang trong local DB:

```bash
docker exec tracking-postgres psql -U tracking -d tracking -c "DROP TABLE IF EXISTS flyway_schema_history;"
```

## Kafka backlog tăng cao
1. Kiểm tra consumer lag từng service.
2. Scale `service-processing` hoặc `service-storage`.
3. Kiểm tra DB write throughput.

## WebSocket push chậm
1. Kiểm tra số session active.
2. Kiểm tra filter viewport và rate limiter.
3. Kiểm tra consumer lag `live-adsb`.

## Rolling update service-ingestion
1. Đảm bảo `terminationGracePeriodSeconds >= 30` cho pod ingestion.
2. Không phụ thuộc `preStop` shell script để tránh lỗi với image distroless.
3. `IngestionShutdownHook` sẽ gọi `KafkaTemplate.flush()` trước khi process terminate.
4. Theo dõi metric `tracking.ingestion.kafka.published` và error code `KAFKA_PRODUCER_UNAVAILABLE` trong lúc rollout.
