# Tracking 2026

Hệ thống theo dõi chuyến bay realtime theo kiến trúc microservices.

## Modules
- `common-dto`
- `service-auth`
- `service-gateway`
- `service-ingestion`
- `service-processing`
- `service-storage`
- `service-broadcaster`
- `frontend-ui`

## Prerequisites
- JDK 17+
- Docker
- Node.js 20+

## Local infra
```bash
docker compose -f infrastructure/docker-compose.yml --env-file infrastructure/.env.example up -d
./infrastructure/kafka/create-topics.sh
```

Observability:
```bash
docker compose -f infrastructure/docker-compose-observability.yml --env-file infrastructure/.env.example up -d
```

Compatibility mode (legacy command vẫn hoạt động):
```bash
docker compose up -d
```

## Build/Test
```bash
./gradlew test
./gradlew :common-dto:test
```

## Docs
- `docs/infrastructure.md`
- `docs/service-auth-hardening.md`
