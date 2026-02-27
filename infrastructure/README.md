# Infrastructure

Nguồn cấu hình runtime hạ tầng cho local/dev và Kubernetes nằm tại thư mục này.

## 1) Khởi chạy core dependencies
```bash
docker compose -f infrastructure/docker-compose.yml --env-file infrastructure/.env.example up -d
./infrastructure/kafka/create-topics.sh
```

Core stack gồm:
- Zookeeper
- Kafka
- PostgreSQL/TimescaleDB
- Redis

## 2) Khởi chạy observability stack
```bash
docker compose -f infrastructure/docker-compose-observability.yml --env-file infrastructure/.env.example up -d
```

Observability stack gồm:
- Prometheus
- Grafana
- Zipkin
- OTel Collector

## 3) Dừng stack
```bash
docker compose -f infrastructure/docker-compose.yml down
docker compose -f infrastructure/docker-compose-observability.yml down
```

## 4) Ghi chú migration
- `docker-compose.yml` ở root vẫn giữ để tương thích local workflow hiện tại.
- Nguồn cấu hình chuẩn để team maintain từ giờ là `infrastructure/`.
