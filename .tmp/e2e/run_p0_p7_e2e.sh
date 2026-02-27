#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

MATRIX_FILE=".tmp/e2e/matrix.tsv"
: > "$MATRIX_FILE"

record() {
  local flow="$1"
  local status="$2"
  local evidence="$3"
  printf "%s\t%s\t%s\n" "$flow" "$status" "$evidence" >> "$MATRIX_FILE"
}

# Ensure infra exists
if ! docker ps --format '{{.Names}}' | grep -q '^tracking-kafka$'; then
  docker compose -f infrastructure/docker-compose.yml --env-file infrastructure/.env.example up -d
fi

./infrastructure/kafka/create-topics.sh localhost:9092 12 1 >/tmp/e2e_topics.log 2>&1 || true
# ensure storage-dlq exists
if docker ps --format '{{.Names}}' | grep -q '^tracking-kafka$'; then
  docker exec tracking-kafka kafka-topics --bootstrap-server localhost:9092 --create --if-not-exists --topic storage-dlq --partitions 12 --replication-factor 1 >/dev/null
fi

# Fresh e2e DB

docker exec tracking-postgres psql -U tracking -d postgres -v ON_ERROR_STOP=1 -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='tracking_e2e_p7' AND pid <> pg_backend_pid();" >/dev/null

docker exec tracking-postgres psql -U tracking -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS tracking_e2e_p7;" >/dev/null

docker exec tracking-postgres psql -U tracking -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE tracking_e2e_p7;" >/dev/null

# Build jars
WINPWD=$(wslpath -w "$ROOT_DIR")
cmd.exe /c "cd /d $WINPWD && set \"JAVA_HOME=C:\\Users\\NamP7\\.jdks\\ms-21.0.9\" && gradlew.bat :service-auth:bootJar :service-gateway:bootJar :service-ingestion:bootJar :service-processing:bootJar :service-storage:bootJar :service-broadcaster:bootJar --no-daemon" >/tmp/e2e_bootjar.log

# Start app stack

docker rm -f tracking-e2e-auth tracking-e2e-gateway tracking-e2e-ingestion tracking-e2e-processing tracking-e2e-storage tracking-e2e-broadcaster >/dev/null 2>&1 || true

docker compose -f .tmp/e2e/docker-compose.apps.yml up -d >/tmp/e2e_compose_up.log

wait_http() {
  local name="$1"; local url="$2"; local retries="${3:-90}"
  local i
  for i in $(seq 1 "$retries"); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  echo "timeout waiting for $name at $url" >&2
  return 1
}

wait_log() {
  local name="$1"; local container="$2"; local pattern="$3"; local retries="${4:-90}"
  local i
  for i in $(seq 1 "$retries"); do
    if docker logs "$container" 2>&1 | grep -q "$pattern"; then
      return 0
    fi
    sleep 2
  done
  echo "timeout waiting log pattern '$pattern' in $name ($container)" >&2
  return 1
}

wait_http "auth" "http://localhost:18081/actuator/health"
wait_http "gateway" "http://localhost:18080/api/v1/auth/.well-known/jwks.json"
wait_http "ingestion" "http://localhost:18082/actuator/health"
wait_http "broadcaster" "http://localhost:18083/actuator/health"
wait_log "processing" "tracking-e2e-processing" "Started ProcessingApplicationKt"
wait_log "storage" "tracking-e2e-storage" "Started StorageApplicationKt"
record "P0-Infra+Apps health" "PASS" "all health endpoints reachable"

# Auth register/login through gateway
register_payload='{"username":"pilot","email":"pilot@example.com","password":"Password@123"}'
register_resp=$(curl -sS -X POST http://localhost:18080/api/v1/auth/register -H 'Content-Type: application/json' -d "$register_payload")
pilot_access=$(echo "$register_resp" | jq -r '.accessToken // empty')
if [[ -n "$pilot_access" ]]; then
  record "P2/P3 Auth register via gateway" "PASS" "access token issued"
else
  record "P2/P3 Auth register via gateway" "FAIL" "response=$register_resp"
  exit 1
fi

admin_login_payload='{"username":"admin","password":"Admin@12345678"}'
admin_login_resp=$(curl -sS -X POST http://localhost:18080/api/v1/auth/login -H 'Content-Type: application/json' -d "$admin_login_payload")
admin_access=$(echo "$admin_login_resp" | jq -r '.accessToken // empty')
if [[ -n "$admin_access" ]]; then
  record "P2 Admin login" "PASS" "bootstrap admin login ok"
else
  record "P2 Admin login" "FAIL" "response=$admin_login_resp"
  exit 1
fi

# Create API key
api_key_resp=$(curl -sS -X POST http://localhost:18080/api/v1/auth/api-keys \
  -H "Authorization: Bearer $admin_access" \
  -H 'Content-Type: application/json' \
  -d '{"sourceId":"RADAR-001"}')
api_key=$(echo "$api_key_resp" | jq -r '.apiKey // empty')
api_key_id=$(echo "$api_key_resp" | jq -r '.id // empty')
if [[ -n "$api_key" && -n "$api_key_id" && "$api_key_id" != "null" ]]; then
  record "P2 API key create" "PASS" "apiKeyId=$api_key_id"
else
  record "P2 API key create" "FAIL" "response=$api_key_resp"
  exit 1
fi

# Gateway authn gate for ingest
unauth_status=$(curl -s -o /tmp/e2e_ingest_noauth.out -w '%{http_code}' -X POST http://localhost:18080/api/v1/ingest/adsb -H 'Content-Type: application/json' -d '{"icao":"ABC123","lat":21.0285,"lon":105.8542,"event_time":1700000000000,"source_id":"RADAR-001"}')
if [[ "$unauth_status" == "401" || "$unauth_status" == "403" ]]; then
  record "P3 Centralized auth at gateway" "PASS" "ingest without api-key => $unauth_status"
else
  record "P3 Centralized auth at gateway" "FAIL" "unexpected status=$unauth_status"
  exit 1
fi

# Ingest valid -> raw kafka -> processing -> live/storage
EVENT1=$(($(date +%s%3N)-2000))
TRACE1='00-11111111111111111111111111111111-2222222222222222-01'
req1_status=""
req1_attempt=0
for req1_attempt in $(seq 1 5); do
  req1_status=$(curl -s -o /tmp/e2e_ingest_ok1.out -w '%{http_code}' -X POST http://localhost:18080/api/v1/ingest/adsb \
    -H 'Content-Type: application/json' \
    -H "x-api-key: $api_key" \
    -H 'X-Source-Id: RADAR-001' \
    -H 'x-request-id: e2e-req-1' \
    -H "traceparent: $TRACE1" \
    -d "{\"icao\":\"ABC123\",\"lat\":21.0285,\"lon\":105.8542,\"event_time\":$EVENT1,\"source_id\":\"RADAR-001\"}")
  if [[ "$req1_status" == "202" ]]; then
    break
  fi
  sleep 1
done
if [[ "$req1_status" == "202" ]]; then
  record "P4 Ingestion accepted" "PASS" "status=202 attempt=$req1_attempt"
else
  record "P4 Ingestion accepted" "FAIL" "status=$req1_status body=$(cat /tmp/e2e_ingest_ok1.out)"
  exit 1
fi

# Wait until persisted
persisted=0
for _ in $(seq 1 30); do
  count=$(docker exec tracking-postgres psql -U tracking -d tracking_e2e_p7 -t -A -c "SELECT count(*) FROM storage.flight_positions WHERE icao='ABC123' AND event_time=to_timestamp($EVENT1 / 1000.0);" 2>/dev/null | tr -d '[:space:]')
  if [[ "$count" =~ ^[0-9]+$ ]] && (( count > 0 )); then
    persisted=1
    break
  fi
  sleep 2
done
if [[ "$persisted" == "1" ]]; then
  trace_row=$(docker exec tracking-postgres psql -U tracking -d tracking_e2e_p7 -t -A -F '|' -c "SELECT request_id, traceparent FROM storage.flight_positions WHERE icao='ABC123' ORDER BY created_at DESC LIMIT 1;" | tr -d '\r')
  record "P5->P6 Processing to Storage" "PASS" "row persisted, trace=$trace_row"
else
  record "P5->P6 Processing to Storage" "FAIL" "record not found in storage.flight_positions"
  exit 1
fi

# WebSocket realtime via gateway
ACCESS_TOKEN="$pilot_access" TIMEOUT_MS=30000 node .tmp/e2e/ws_stomp_check.js > /tmp/e2e_ws_msg.out 2>/tmp/e2e_ws_err.out &
ws_pid=$!
sleep 2
req2_status="000"
for point in "21.0288,105.8545" "21.0289,105.8546" "21.0290,105.8547" "21.0291,105.8548"; do
  lat="${point%,*}"
  lon="${point#*,}"
  EVENT2=$(($(date +%s%3N)+1000))
  req2_status=$(curl -s -o /tmp/e2e_ingest_ok2.out -w '%{http_code}' -X POST http://localhost:18080/api/v1/ingest/adsb \
    -H 'Content-Type: application/json' \
    -H "x-api-key: $api_key" \
    -H 'X-Source-Id: RADAR-001' \
    -H 'x-request-id: e2e-req-2' \
    -d "{\"icao\":\"ABC123\",\"lat\":$lat,\"lon\":$lon,\"event_time\":$EVENT2,\"source_id\":\"RADAR-001\"}")
  if ! kill -0 "$ws_pid" 2>/dev/null; then
    break
  fi
  sleep 1
done
wait "$ws_pid" || true
if [[ "$req2_status" == "202" && -s /tmp/e2e_ws_msg.out ]] && grep -q 'ABC123' /tmp/e2e_ws_msg.out; then
  record "P7 WebSocket broadcast via gateway" "PASS" "received STOMP message with ICAO ABC123"
else
  record "P7 WebSocket broadcast via gateway" "FAIL" "ingest_status=$req2_status ws_err=$(cat /tmp/e2e_ws_err.out 2>/dev/null) ws_msg=$(cat /tmp/e2e_ws_msg.out 2>/dev/null)"
  exit 1
fi

# Gateway rate limit check for /login (burst 10): send 20 quick requests, expect at least one 429
rate_429=0
for _ in $(seq 1 20); do
  code=$(curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:18080/api/v1/auth/login -H 'Content-Type: application/json' -d "$admin_login_payload")
  if [[ "$code" == "429" ]]; then
    rate_429=1
  fi
done
if [[ "$rate_429" == "1" ]]; then
  record "P3 Rate limiting /auth/login" "PASS" "429 observed"
else
  record "P3 Rate limiting /auth/login" "FAIL" "no 429 observed in burst"
  exit 1
fi

# Revoke API key and verify propagation blocks ingest
revoke_status=$(curl -s -o /tmp/e2e_revoke.out -w '%{http_code}' -X POST \
  "http://localhost:18080/api/v1/auth/api-keys/$api_key_id/revoke" \
  -H "Authorization: Bearer $admin_access")
if [[ "$revoke_status" == "204" ]]; then
  record "P2 Revoke API key" "PASS" "revoke endpoint returned 204"
else
  record "P2 Revoke API key" "FAIL" "status=$revoke_status body=$(cat /tmp/e2e_revoke.out)"
  exit 1
fi

revoked_blocked=0
for _ in $(seq 1 15); do
  code=$(curl -s -o /tmp/e2e_ingest_revoked.out -w '%{http_code}' -X POST http://localhost:18080/api/v1/ingest/adsb \
    -H 'Content-Type: application/json' \
    -H "x-api-key: $api_key" \
    -H 'X-Source-Id: RADAR-001' \
    -d "{\"icao\":\"ABC123\",\"lat\":21.2,\"lon\":105.9,\"event_time\":$((EVENT2+1000)),\"source_id\":\"RADAR-001\"}")
  if [[ "$code" == "401" || "$code" == "403" ]]; then
    revoked_blocked=1
    break
  fi
  sleep 1
done
if [[ "$revoked_blocked" == "1" ]]; then
  record "P3/P4 Revocation propagation (Kafka)" "PASS" "revoked api-key blocked at gateway/ingestion"
else
  record "P3/P4 Revocation propagation (Kafka)" "FAIL" "revoked key still accepted"
  exit 1
fi

# CORS check at gateway
cors_headers=$(curl -s -D - -o /dev/null -X OPTIONS http://localhost:18080/api/v1/auth/login \
  -H 'Origin: http://localhost:5173' \
  -H 'Access-Control-Request-Method: POST')
if echo "$cors_headers" | grep -qi 'access-control-allow-origin'; then
  record "P3 CORS centralized" "PASS" "allow-origin header present"
else
  record "P3 CORS centralized" "FAIL" "missing allow-origin"
  exit 1
fi

echo "E2E done. Matrix at $MATRIX_FILE"
