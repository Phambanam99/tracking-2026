# Infrastructure

## Mục tiêu
- Chuẩn hóa runtime stack cho local/dev tại `infrastructure/`.
- Tách core dependencies và observability stack để bật/tắt độc lập.
- Có baseline Kubernetes (Helm) cho dev/stg/prod.

## Local runtime

### Core dependencies
```bash
docker compose -f infrastructure/docker-compose.yml --env-file infrastructure/.env.example up -d
./infrastructure/kafka/create-topics.sh
```

### Observability
```bash
docker compose -f infrastructure/docker-compose-observability.yml --env-file infrastructure/.env.example up -d
```

Nếu service runtime không publish metrics trên dải mặc định `8080-8085`, override bằng:
```bash
SERVICE_GATEWAY_METRICS_TARGET=host.docker.internal:18080 \
SERVICE_AUTH_METRICS_TARGET=host.docker.internal:18081 \
SERVICE_INGESTION_METRICS_TARGET=host.docker.internal:18082 \
SERVICE_BROADCASTER_METRICS_TARGET=host.docker.internal:18083 \
SERVICE_STORAGE_METRICS_TARGET=host.docker.internal:18084 \
SERVICE_PROCESSING_METRICS_TARGET=host.docker.internal:18085 \
docker compose -f infrastructure/docker-compose-observability.yml --env-file infrastructure/.env.example up -d
```

### Kiểm tra nhanh
- Kafka: `localhost:29092`
- Postgres: `localhost:5432`
- Redis: `localhost:6379`
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3000`
- Zipkin: `http://localhost:9411`

## Kubernetes baseline
- Chart: `infrastructure/k8s/helm/tracking-platform`
- Env values:
  - `infrastructure/k8s/environments/dev/values.yaml`
  - `infrastructure/k8s/environments/stg/values.yaml`
  - `infrastructure/k8s/environments/prod/values.yaml`
- Baseline manifests:
  - Ingress cho gateway
  - ConfigMap dùng chung cho runtime env
  - Secret (create có điều kiện hoặc trỏ secret có sẵn)
  - NetworkPolicy (default deny ingress + public ingress cho gateway + allow nội bộ namespace)

## Migration policy
- `docker-compose.yml` ở root vẫn giữ để không phá local workflow hiện tại.
- Team dùng `infrastructure/` làm nguồn cấu hình chuẩn mới.
- Nội dung cũ trong `infra/` và `observability/` được tham chiếu dần theo kế hoạch migration.
