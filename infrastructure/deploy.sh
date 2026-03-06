#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Orchestrated deploy script for tracking-2026
# Usage:
#   cd infrastructure
#   bash deploy.sh [all|stack|core|apps|connectors|observability|down|clean]
#
# Thứ tự đảm bảo: core → kafka topics → apps → connectors → observability
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

ENV_FILE=".env.example"
if [[ -f ".env" ]]; then
  ENV_FILE=".env"
fi

log() { echo -e "\033[1;36m[$(date '+%H:%M:%S')] $*\033[0m"; }
ok()  { echo -e "\033[1;32m[$(date '+%H:%M:%S')] ✓ $*\033[0m"; }
err() { echo -e "\033[1;31m[$(date '+%H:%M:%S')] ✗ $*\033[0m" >&2; exit 1; }

TARGET="${1:-all}"

# ─── Compose helpers (mỗi file dùng đúng project name) ──────────────────────
compose_core() {
  docker compose -p tracking-core -f docker-compose.yml --env-file "$ENV_FILE" "$@"
}
compose_apps() {
  docker compose -p tracking-apps -f docker-compose-apps.yml --env-file "$ENV_FILE" "$@"
}
compose_connectors() {
  docker compose -p tracking-connectors -f docker-compose-connectors.yml --env-file "$ENV_FILE" "$@"
}
compose_observability() {
  docker compose -p tracking-observability -f docker-compose-observability.yml --env-file "$ENV_FILE" "$@"
}
compose_geoserver() {
  docker compose -p tracking-geoserver -f docker-compose-geoserver.yml --env-file "$ENV_FILE" "$@"
}

# ─── Helper: xóa containers cũ để tránh "already in use" conflict ────────────
remove_containers() {
  for c in "$@"; do
    if docker ps -a --format '{{.Names}}' | grep -qx "$c"; then
      log "Removing existing container: $c"
      docker rm -f "$c" > /dev/null
    fi
  done
}

# ─── Core Infra ──────────────────────────────────────────────────────────────
deploy_core() {
  log "Starting core infra (Zookeeper, Kafka, Postgres, Redis, Postgres-Readonly)..."
  compose_core up -d --wait --timeout 120
  ok "Core infra ready"

  log "Creating Kafka topics..."
  bash kafka/create-topics.sh
  ok "Kafka topics created"
}

# ─── Apps ────────────────────────────────────────────────────────────────────
deploy_apps() {
  log "Starting Java application services..."
  remove_containers \
    tracking-service-auth \
    tracking-service-ingestion \
    tracking-service-processing \
    tracking-service-storage \
    tracking-service-broadcaster \
    tracking-service-query \
    tracking-service-gateway \
    tracking-frontend-ui

  compose_apps up -d
  ok "Applications started (health checks running in background)"
}

# ─── Connectors ──────────────────────────────────────────────────────────────
deploy_connectors() {
  log "Building & starting connectors..."
  remove_containers \
    tracking-adsb-hckt-connector \
    tracking-adsbx-connector \
    tracking-fr24-connector \
    tracking-radarbox-connector \
    tracking-chinaport-connector \
    tracking-aisstream-connector \
    tracking-ais-signalr-connector

  compose_connectors up -d --build
  ok "Connectors started"
}

# ─── GeoServer ───────────────────────────────────────────────────────────────
deploy_geoserver() {
  log "Starting GeoServer..."
  remove_containers tracking-geoserver
  compose_geoserver up -d --wait --timeout 180
  ok "GeoServer ready at http://localhost:${GEOSERVER_PORT:-8600}/geoserver/web/"
}

# ─── Observability ───────────────────────────────────────────────────────────
deploy_observability() {
  log "Starting observability stack..."
  remove_containers \
    tracking-prometheus \
    tracking-grafana \
    tracking-zipkin \
    tracking-otel-collector \
    tracking-postgres-exporter \
    tracking-redis-exporter \
    tracking-kafka-exporter \
    tracking-loki \
    tracking-promtail

  compose_observability up -d --wait --timeout 120 \
    zipkin otel-collector postgres-exporter \
    loki promtail prometheus grafana

  # Start exporters without healthchecks in background (non-blocking)
  compose_observability up -d redis-exporter kafka-exporter

  ok "Observability ready"
}

# ─── Bootstrap API Keys ──────────────────────────────────────────────────────
bootstrap_api_keys() {
  if ! command -v jq &>/dev/null || ! command -v curl &>/dev/null; then
    log "WARNING: curl or jq not found — skipping API key bootstrap"
    log "Run manually after deploy: bash bootstrap-api-keys.sh"
    return 0
  fi
  log "Provisioning connector API keys..."
  bash "$SCRIPT_DIR/bootstrap-api-keys.sh" || {
    log "WARNING: API key bootstrap failed — connectors will need API_KEY set manually"
  }
}

# ─── Down (stop & remove containers per project) ─────────────────────────────
do_down() {
  log "Stopping all services..."
  compose_observability down 2>/dev/null || true
  compose_geoserver down 2>/dev/null || true
  compose_connectors down 2>/dev/null || true
  compose_apps down 2>/dev/null || true
  compose_core down 2>/dev/null || true
  ok "All services stopped"
}

# ─── Clean (down + remove volumes) ───────────────────────────────────────────
do_clean() {
  do_down
  log "Removing volumes..."
  compose_core down -v 2>/dev/null || true
  compose_apps down -v 2>/dev/null || true
  compose_connectors down -v 2>/dev/null || true
  compose_geoserver down -v 2>/dev/null || true
  compose_observability down -v 2>/dev/null || true
  ok "Volumes removed"
}

# ─── Main ────────────────────────────────────────────────────────────────────
case "$TARGET" in
  all|full)
    deploy_core
    deploy_apps
    bootstrap_api_keys
    deploy_connectors
    deploy_observability
    ;;
  stack)
    deploy_core
    deploy_apps
    bootstrap_api_keys
    ;;
  core)
    deploy_core
    ;;
  apps)
    deploy_apps
    ;;
  connectors)
    deploy_connectors
    ;;
  geoserver)
    deploy_geoserver
    ;;
  observability)
    deploy_observability
    ;;
  down)
    do_down
    ;;
  clean)
    do_clean
    ;;
  *)
    echo "Usage: $0 [all|stack|core|apps|connectors|geoserver|observability|down|clean]"
    echo ""
    echo "  all/full      - everything (default)"
    echo "  stack         - core + apps only"
    echo "  core          - core infra only (Kafka, Postgres, Redis)"
    echo "  apps          - Java services + frontend"
    echo "  connectors    - data connectors only"
    echo "  geoserver     - GeoServer map tile server"
    echo "  observability - monitoring stack only"
    echo "  down          - stop all services"
    echo "  clean         - down + remove volumes"
    exit 1
    ;;
esac

log "Deploy complete! Services:"
docker ps --filter "name=tracking-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || true
