#!/usr/bin/env bash
set -euo pipefail

BROKER="${1:-localhost:9092}"
PARTITIONS="${2:-24}"
REPLICATION="${3:-1}"

TOPICS=(
  "raw-adsb"
  "live-adsb"
  "historical-adsb"
  "invalid-telemetry-dlq"
  "auth-revocation"
)

if ! docker ps --format '{{.Names}}' | grep -q '^tracking-kafka$'; then
  echo "tracking-kafka container is not running. Start core stack first:" >&2
  echo "  docker compose -f infrastructure/docker-compose.yml --env-file infrastructure/.env.example up -d" >&2
  exit 1
fi

echo "Waiting for Kafka broker ${BROKER} to become ready..."
for _ in $(seq 1 45); do
  if docker exec tracking-kafka kafka-topics --bootstrap-server "$BROKER" --list >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! docker exec tracking-kafka kafka-topics --bootstrap-server "$BROKER" --list >/dev/null 2>&1; then
  echo "Kafka broker ${BROKER} is not ready after timeout." >&2
  exit 1
fi

for topic in "${TOPICS[@]}"; do
  docker exec tracking-kafka kafka-topics \
    --bootstrap-server "$BROKER" \
    --create \
    --if-not-exists \
    --topic "$topic" \
    --partitions "$PARTITIONS" \
    --replication-factor "$REPLICATION"
done

echo "Created topics: ${TOPICS[*]}"
