# CI/CD & Deployment Guide

## Tổng quan kiến trúc

```
tracking-2026/
├── common-dto/           – Shared DTOs (Kotlin)
├── service-auth/         – Authentication service   :8081
├── service-gateway/      – API Gateway              :8080
├── service-ingestion/    – Data ingestion           :8082
├── service-processing/   – Stream processing        :8085
├── service-storage/      – Storage service          :8084
├── service-broadcaster/  – WebSocket broadcaster    :8083
├── service-query/        – Query service            :8085 (ext: 8086)
├── frontend-ui/          – React/Vite SPA           :5173 (dev)
├── connectors/           – Python ADS-B connectors
└── infrastructure/       – Docker Compose & k8s configs
```

**Tech stack:**

- Backend: Kotlin + Spring Boot 3, JDK 17/21
- Frontend: React 18, Vite 6, TypeScript 5.7
- DB: PostgreSQL 15 + TimescaleDB 2.17
- Message broker: Apache Kafka (cp-kafka:7.6.1)
- Cache: Redis 7.2
- Build: Gradle 9.2 (Kotlin DSL)

---

## GitHub Actions Workflows

### Workflow hiện có

| File                 | Trigger                 | Mô tả                                            |
| -------------------- | ----------------------- | ------------------------------------------------ |
| `build.yml`          | push `main/master`, PR  | Build tất cả Gradle modules                      |
| `test.yml`           | PR                      | Chạy unit tests                                  |
| `security.yml`       | PR, push `main`, weekly | Dependency review, secret scan, Trivy, npm audit |
| `infra-validate.yml` | –                       | Validate infrastructure configs                  |
| `perf-smoke.yml`     | –                       | Smoke performance tests                          |

### Vấn đề hiện tại với workflows

Các workflow hiện tại đang dùng JDK 17 nhưng một số module (service-query, service-gateway) đã chuyển sang JDK 21. Cần update:

```yaml
# Trong build.yml và test.yml — đổi java-version từ '17' thành '21'
- uses: actions/setup-java@v4
  with:
    distribution: temurin
    java-version: "21"
```

---

## Quy trình CI/CD đề xuất

### 1. Pull Request Flow

```
developer push → PR created
                  │
                  ├─► test.yml         (unit tests)
                  ├─► security.yml     (dependency review + secret scan)
                  └─► build.yml        (compile all modules)

                  ↓ (all checks pass)

              PR review → merge to main
```

### 2. Main Branch Flow (Production Deploy)

```
merge to main
     │
     ├─► build.yml          (build + compile)
     ├─► security.yml       (Trivy scan, dependency submission)
     └─► [deploy workflow]  (xem phần dưới)
```

---

## Hướng dẫn chạy local (Development)

### Yêu cầu hệ thống

| Tool           | Version                          |
| -------------- | -------------------------------- |
| JDK            | 21 (Eclipse Temurin khuyến nghị) |
| Node.js        | 20+                              |
| Docker Desktop | 24+                              |
| Docker Compose | v2                               |
| Python         | 3.11+ (cho connectors)           |

### Bước 1: Khởi động infrastructure

```bash
# Từ thư mục infrastructure/
cd infrastructure

# Copy và chỉnh sửa env
cp .env.example .env

# Khởi động core services (Kafka, Postgres, Redis)
docker compose up -d

# Kiểm tra services healthy
docker compose ps
```

### Bước 2: Build backend services

```bash
# Từ root project
./gradlew build -x test

# Build từng service độc lập
./gradlew :service-auth:bootJar
./gradlew :service-gateway:bootJar
./gradlew :service-query:bootJar
# ... tương tự cho các service khác
```

### Bước 3: Chạy backend services

```bash
# Chạy tất cả services với profile local
./gradlew :service-auth:bootRun --args="--spring.profiles.active=local"
./gradlew :service-gateway:bootRun --args="--spring.profiles.active=local"
./gradlew :service-query:bootRun --args="--spring.profiles.active=local"
./gradlew :service-ingestion:bootRun --args="--spring.profiles.active=local"
./gradlew :service-storage:bootRun --args="--spring.profiles.active=local"
./gradlew :service-processing:bootRun --args="--spring.profiles.active=local"
./gradlew :service-broadcaster:bootRun --args="--spring.profiles.active=local"
```

### Bước 4: Chạy frontend

```bash
cd frontend-ui
npm install
npm run dev
# Mở http://localhost:5173
```

### Bước 5: Chạy connectors (tuỳ chọn)

```bash
cd connectors

# Windows
./bootstrap_venv.ps1
./run_connector.sh fr24    # hoặc adsbx, radarbox

# Linux/macOS
./bootstrap_venv.sh
./run_connector.sh fr24
```

---

## Hướng dẫn deploy với Docker Compose

### Cấu trúc Docker Compose overlay

```
infrastructure/
├── docker-compose.yml                # Core: Kafka, Postgres, Redis
├── docker-compose-query.yml          # service-query overlay
├── docker-compose-connectors.yml     # ADS-B connectors overlay
└── docker-compose-observability.yml  # Prometheus, Grafana, Loki overlay
```

### Deploy production stack

```bash
cd infrastructure

# 1. Chuẩn bị env file
cp .env.example .env
# Chỉnh sửa .env với thông tin thực (DB password, secrets, ...)

# 2. Khởi động core + query service
docker compose \
  -f docker-compose.yml \
  -f docker-compose-query.yml \
  up -d

# 3. Thêm observability (tuỳ chọn)
docker compose \
  -f docker-compose.yml \
  -f docker-compose-observability.yml \
  up -d

# 4. Kiểm tra tất cả services
docker compose ps
docker compose logs -f service-query
```

### Build và deploy service đã cập nhật

```bash
# 1. Build JAR mới
./gradlew :service-query:clean :service-query:bootJar -x test

# 2. Recreate container
cd infrastructure
docker compose -f docker-compose.yml -f docker-compose-query.yml \
  up -d --force-recreate service-query

# 3. Kiểm tra health
curl http://localhost:8086/actuator/health
```

### Environment variables quan trọng

| Variable                  | Mô tả                          | Default                                                      |
| ------------------------- | ------------------------------ | ------------------------------------------------------------ |
| `POSTGRES_USER`           | DB username                    | `tracking`                                                   |
| `POSTGRES_PASSWORD`       | DB password                    | `tracking`                                                   |
| `POSTGRES_DB`             | DB name                        | `tracking`                                                   |
| `KAFKA_BOOTSTRAP_SERVERS` | Kafka connection               | `localhost:9092`                                             |
| `REDIS_HOST`              | Redis host                     | `localhost`                                                  |
| `REDIS_PORT`              | Redis port                     | `6379`                                                       |
| `AUTH_JWKS_URI`           | JWKS endpoint của auth service | `http://service-auth:8081/api/v1/auth/.well-known/jwks.json` |
| `SPRING_PROFILES_ACTIVE`  | Spring profile                 | `local`                                                      |

---

## E2E Test Stack

Project có stack riêng cho integration/E2E tests tại `.tmp/e2e/`:

```bash
# Khởi động E2E stack
cd .tmp/e2e
docker compose -f docker-compose.apps.yml -p tracking-apps-e2e up -d

# Ports của E2E stack (tránh xung đột với local dev)
# gateway:     18080
# auth:        18081
# ingestion:   18082
# broadcaster: 18083
# storage:     18084
# query:       18086
```

---

## Hướng dẫn deploy GitHub Actions (CI/CD tự động)

### Thêm workflow deploy (ví dụ deploy lên VPS/server)

Tạo file `.github/workflows/deploy.yml`:

```yaml
name: deploy

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: "21"
          cache: gradle

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm
          cache-dependency-path: frontend-ui/package-lock.json

      # Build backend JARs
      - name: Build backend
        run: ./gradlew bootJar -x test

      # Build frontend
      - name: Build frontend
        working-directory: frontend-ui
        run: |
          npm ci
          npm run build

      # Deploy qua SSH
      - name: Deploy to server
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: ${{ secrets.DEPLOY_USER }}
          key: ${{ secrets.DEPLOY_SSH_KEY }}
          script: |
            cd /opt/tracking
            git pull origin main
            ./gradlew bootJar -x test
            docker compose -f infrastructure/docker-compose.yml up -d --force-recreate
```

### GitHub Secrets cần thiết

Vào **Settings → Secrets and variables → Actions** và thêm:

| Secret           | Mô tả                       |
| ---------------- | --------------------------- |
| `DEPLOY_HOST`    | IP hoặc hostname của server |
| `DEPLOY_USER`    | SSH username                |
| `DEPLOY_SSH_KEY` | Private SSH key             |

---

## Hướng dẫn deploy Kubernetes (production)

Helm chart có sẵn tại `infrastructure/k8s/helm/tracking-platform/`.

```bash
# 1. Cài đặt cert-manager (nếu chưa có)
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml

# 2. Tạo namespace
kubectl create namespace tracking

# 3. Tạo secrets
kubectl create secret generic tracking-db-secret \
  --from-literal=password=YOUR_DB_PASSWORD \
  -n tracking

# 4. Deploy với Helm
helm upgrade --install tracking-platform \
  infrastructure/k8s/helm/tracking-platform \
  --namespace tracking \
  --values infrastructure/k8s/environments/production/values.yaml

# 5. Kiểm tra
kubectl get pods -n tracking
kubectl logs -f deployment/service-query -n tracking
```

---

## Kiểm tra và troubleshooting

### Health checks

```bash
# Gateway
curl http://localhost:8080/actuator/health

# Auth
curl http://localhost:8081/actuator/health

# Query
curl http://localhost:8085/actuator/health  # local
curl http://localhost:18086/actuator/health # docker E2E

# Kiểm tra Kafka topics
docker exec tracking-kafka kafka-topics \
  --bootstrap-server localhost:9092 --list

# Kiểm tra DB
docker exec -it tracking-postgres \
  psql -U tracking -d tracking -c "\dt storage.*"
```

### Xem logs

```bash
# Docker Compose
docker compose logs -f service-query
docker compose logs -f service-gateway

# Tất cả services
docker compose logs -f

# Lọc lỗi
docker compose logs service-query 2>&1 | grep -i error
```

### DB migrations

Flyway chạy tự động khi service khởi động. Để kiểm tra migration history:

```sql
-- Trong psql
SELECT version, description, installed_on, success
FROM flyway_schema_history
ORDER BY installed_rank;
```

---

## Tóm tắt lệnh hay dùng

```bash
# Build toàn bộ
./gradlew build -x test

# Chạy tests
./gradlew test
cd frontend-ui && npx vitest run

# Build JAR cụ thể
./gradlew :service-query:clean :service-query:bootJar -x test

# Restart service trong Docker
docker compose -f docker-compose.yml -f docker-compose-query.yml \
  up -d --force-recreate service-query

# Xem tất cả ports đang listen
netstat -ano | findstr "LISTENING" | findstr "808"
```
