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

## Kafka backlog tăng cao
1. Kiểm tra consumer lag từng service.
2. Scale `service-processing` hoặc `service-storage`.
3. Kiểm tra DB write throughput.

## WebSocket push chậm
1. Kiểm tra số session active.
2. Kiểm tra filter viewport và rate limiter.
3. Kiểm tra consumer lag `live-adsb`.
