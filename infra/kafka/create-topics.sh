#!/usr/bin/env bash
set -euo pipefail

BROKER="${1:-localhost:9092}"
PARTITIONS="${2:-24}"
REPLICATION="${3:-1}"

TOPICS=(
  "raw-adsb"
  "live-adsb"
  "historical-adsb"
  "invalid-adsb-dlq"
  "auth-revocation"
)

for topic in "${TOPICS[@]}"; do
  docker exec tracking-kafka kafka-topics.sh \
    --bootstrap-server "$BROKER" \
    --create \
    --if-not-exists \
    --topic "$topic" \
    --partitions "$PARTITIONS" \
    --replication-factor "$REPLICATION"
done

echo "Created topics: ${TOPICS[*]}"
