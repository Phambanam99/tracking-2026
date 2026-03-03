#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

PROMETHEUS_BASE_URL="${PROMETHEUS_BASE_URL:-http://localhost:9090}"
OUTPUT_FILE="${OUTPUT_FILE:-perf/.generated/prometheus-snapshots.ndjson}"
INTERVAL_SECONDS="${INTERVAL_SECONDS:-60}"
DURATION_SECONDS="${DURATION_SECONDS:-0}"
RUN_ONCE="${RUN_ONCE:-0}"
JQ_BIN="${JQ_BIN:-jq}"

mkdir -p "$(dirname "$OUTPUT_FILE")"

declare -a QUERIES=(
  "ingestion_records_rate|sum(rate(tracking_ingestion_accepted_batch_records_total[1m]))"
  "ingestion_publish_rate|sum(rate(tracking_ingestion_kafka_published_total[1m]))"
  "ingestion_publish_failed_rate|sum(rate(tracking_ingestion_kafka_publish_failed_total[1m]))"
  "ingestion_admission_reject_rate|sum(rate(tracking_ingestion_rejected_admission_total[1m]))"
  "ingestion_producer_reject_rate|sum(rate(tracking_ingestion_rejected_producer_unavailable_total[1m]))"
  "processing_pipeline_p95|histogram_quantile(0.95,sum(rate(tracking_processing_pipeline_latency_seconds_bucket[1m])) by (le))"
  "processing_live_rate|sum(rate(tracking_processing_published_live_total[1m]))"
  "processing_historical_rate|sum(rate(tracking_processing_published_historical_total[1m]))"
  "processing_dlq_rate|sum(rate(tracking_processing_published_dlq_total[1m]))"
  "storage_batch_p95|histogram_quantile(0.95,sum(rate(tracking_storage_batch_latency_seconds_bucket[1m])) by (le))"
  "storage_buffer_size|max(tracking_storage_buffer_size)"
  "storage_batch_failures_5m|sum(increase(tracking_storage_batch_failed_total[5m]))"
  "ws_sessions_active|max(ws_sessions_active)"
  "ws_push_p95|histogram_quantile(0.95,sum(rate(ws_push_latency_seconds_bucket[1m])) by (le))"
  "jvm_heap_used|max(jvm_memory_used_bytes{area=\"heap\"})"
  "alerts_firing|sum(ALERTS{alertstate=\"firing\"}) or vector(0)"
)

require_bin() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "missing required binary: $1" >&2
    exit 1
  fi
}

require_bin curl
require_bin "$JQ_BIN"

snapshot_once() {
  local now metric query response status value sample_count
  now="$(date -Iseconds)"
  for entry in "${QUERIES[@]}"; do
    metric="${entry%%|*}"
    query="${entry#*|}"
    response="$(curl -fsS --get --data-urlencode "query=${query}" "${PROMETHEUS_BASE_URL}/api/v1/query")"
    status="$(printf '%s' "$response" | "$JQ_BIN" -r '.status')"
    sample_count="$(printf '%s' "$response" | "$JQ_BIN" -r '
      if .data.resultType == "vector" then (.data.result | length)
      elif .data.resultType == "scalar" then 1
      else 0
      end
    ')"
    value="$(printf '%s' "$response" | "$JQ_BIN" -r '
      if .data.resultType == "vector" then
        if (.data.result | length) == 0 then "NaN"
        else (.data.result[0].value[1] // "NaN")
        end
      elif .data.resultType == "scalar" then
        (.data.result[1] // "NaN")
      else
        "NaN"
      end
    ')"
    printf '{"timestamp":"%s","metric":"%s","status":"%s","samples":%s,"value":"%s","query":%s}\n' \
      "$now" "$metric" "$status" "$sample_count" "$value" \
      "$(printf '%s' "$query" | "$JQ_BIN" -Rsa .)" >> "$OUTPUT_FILE"
  done
}

if [[ "$RUN_ONCE" == "1" ]]; then
  snapshot_once
  exit 0
fi

start_epoch="$(date +%s)"
while true; do
  snapshot_once
  if [[ "$DURATION_SECONDS" -gt 0 ]]; then
    now_epoch="$(date +%s)"
    if (( now_epoch - start_epoch >= DURATION_SECONDS )); then
      break
    fi
  fi
  sleep "$INTERVAL_SECONDS"
done
