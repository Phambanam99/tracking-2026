#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

RUN_ID_PREFIX="${RUN_ID_PREFIX:-ci-pr-smoke-$(date +%Y%m%d-%H%M%S)}"
REPORT_ROOT="${REPORT_ROOT:-perf/reports}"
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-http://localhost:18080}"
PROMETHEUS_BASE_URL="${PROMETHEUS_BASE_URL:-http://localhost:9090}"
OBSERVABILITY_ENV_FILE="${OBSERVABILITY_ENV_FILE:-infrastructure/.env.example}"
WARMUP_RUN_ID="${RUN_ID_PREFIX}-warmup"
BUNDLE_DIR="${REPORT_ROOT}/${RUN_ID_PREFIX}-bundle"
WARMUP_RUN_DIR="${REPORT_ROOT}/${WARMUP_RUN_ID}"
DB_NAME="${DB_NAME:-tracking_e2e_p7}"

SMOKE_DURATION_OVERRIDE="${SMOKE_DURATION_OVERRIDE:-20s}"
SMOKE_REQUEST_RATE_OVERRIDE="${SMOKE_REQUEST_RATE_OVERRIDE:-2}"
SMOKE_BATCH_SIZE="${SMOKE_BATCH_SIZE:-200}"
SMOKE_PRE_ALLOCATED_VUS="${SMOKE_PRE_ALLOCATED_VUS:-2}"
SMOKE_MAX_VUS="${SMOKE_MAX_VUS:-4}"
SMOKE_PROM_INTERVAL_SECONDS="${SMOKE_PROM_INTERVAL_SECONDS:-5}"

wait_http() {
  local name="$1"
  local url="$2"
  local retries="${3:-60}"
  local attempt

  for attempt in $(seq 1 "$retries"); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done

  echo "timeout waiting for ${name} at ${url}" >&2
  return 1
}

wait_container_healthy() {
  local name="$1"
  local retries="${2:-60}"
  local attempt
  local status

  for attempt in $(seq 1 "$retries"); do
    status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$name" 2>/dev/null || true)"
    if [[ "$status" == "healthy" || "$status" == "running" ]]; then
      return 0
    fi
    sleep 2
  done

  echo "timeout waiting for container ${name} to become healthy" >&2
  return 1
}

ensure_db() {
  docker exec tracking-postgres psql -U tracking -d postgres -v ON_ERROR_STOP=1 \
    -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${DB_NAME}' AND pid <> pg_backend_pid();" >/dev/null
  docker exec tracking-postgres psql -U tracking -d postgres -v ON_ERROR_STOP=1 \
    -c "DROP DATABASE IF EXISTS ${DB_NAME};" >/dev/null
  docker exec tracking-postgres psql -U tracking -d postgres -v ON_ERROR_STOP=1 \
    -c "CREATE DATABASE ${DB_NAME};" >/dev/null
}

mkdir -p "$REPORT_ROOT"

docker compose -f infrastructure/docker-compose.yml --env-file infrastructure/.env.example up -d >/tmp/pr_perf_smoke_infra.log
wait_container_healthy tracking-zookeeper
wait_container_healthy tracking-kafka
wait_container_healthy tracking-postgres
wait_container_healthy tracking-redis
./infrastructure/kafka/create-topics.sh localhost:29092 12 1 >/tmp/pr_perf_smoke_topics.log 2>&1 || true
docker exec tracking-kafka kafka-topics --bootstrap-server localhost:9092 --create --if-not-exists --topic storage-dlq --partitions 12 --replication-factor 1 >/dev/null

ensure_db

SERVICE_GATEWAY_METRICS_TARGET="${SERVICE_GATEWAY_METRICS_TARGET:-host.docker.internal:18080}" \
SERVICE_AUTH_METRICS_TARGET="${SERVICE_AUTH_METRICS_TARGET:-host.docker.internal:18081}" \
SERVICE_INGESTION_METRICS_TARGET="${SERVICE_INGESTION_METRICS_TARGET:-host.docker.internal:18082}" \
SERVICE_BROADCASTER_METRICS_TARGET="${SERVICE_BROADCASTER_METRICS_TARGET:-host.docker.internal:18083}" \
SERVICE_STORAGE_METRICS_TARGET="${SERVICE_STORAGE_METRICS_TARGET:-host.docker.internal:18084}" \
SERVICE_PROCESSING_METRICS_TARGET="${SERVICE_PROCESSING_METRICS_TARGET:-host.docker.internal:18085}" \
docker compose -f infrastructure/docker-compose-observability.yml --env-file "$OBSERVABILITY_ENV_FILE" up -d >/tmp/pr_perf_smoke_obs.log

wait_container_healthy tracking-prometheus
wait_http "prometheus" "${PROMETHEUS_BASE_URL}/-/ready"

docker rm -f tracking-e2e-auth tracking-e2e-gateway tracking-e2e-ingestion tracking-e2e-processing tracking-e2e-storage tracking-e2e-broadcaster >/dev/null 2>&1 || true
docker compose -f .tmp/e2e/docker-compose.apps.yml up -d >/tmp/pr_perf_smoke_apps.log

wait_http "auth" "http://localhost:18081/actuator/health"
wait_http "gateway" "http://localhost:18080/api/v1/auth/.well-known/jwks.json"
wait_http "ingestion" "http://localhost:18082/actuator/health"
wait_http "broadcaster" "http://localhost:18083/actuator/health"
wait_http "storage" "http://localhost:18084/actuator/health"
wait_http "processing" "http://localhost:18085/actuator/health"

PUBLIC_BASE_URL="$PUBLIC_BASE_URL" perf/scripts/provision-multi-source-api-keys.sh >/tmp/pr_perf_smoke_keys.log

PUBLIC_BASE_URL="$PUBLIC_BASE_URL" \
PROMETHEUS_BASE_URL="$PROMETHEUS_BASE_URL" \
RUN_ID="$WARMUP_RUN_ID" \
DURATION_OVERRIDE="$SMOKE_DURATION_OVERRIDE" \
REQUEST_RATE_OVERRIDE="$SMOKE_REQUEST_RATE_OVERRIDE" \
BATCH_SIZE="$SMOKE_BATCH_SIZE" \
PRE_ALLOCATED_VUS_OVERRIDE="$SMOKE_PRE_ALLOCATED_VUS" \
MAX_VUS_OVERRIDE="$SMOKE_MAX_VUS" \
PROM_INTERVAL_SECONDS="$SMOKE_PROM_INTERVAL_SECONDS" \
perf/scripts/run-multi-source-load.sh warmup

ENVIRONMENT=docker-e2e perf/scripts/generate-multi-source-report.sh "$WARMUP_RUN_DIR" >/dev/null
perf/scripts/assemble-multi-source-bundle.sh "$BUNDLE_DIR" "$WARMUP_RUN_DIR" >/dev/null
ENVIRONMENT=docker-e2e perf/scripts/generate-multi-source-report.sh "$BUNDLE_DIR" >/dev/null

printf 'WARMUP_RUN_DIR=%s\n' "$WARMUP_RUN_DIR"
printf 'BUNDLE_DIR=%s\n' "$BUNDLE_DIR"
