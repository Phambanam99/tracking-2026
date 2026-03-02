#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

RUN_DIR="${1:-${RUN_DIR:-}}"
if [[ -z "$RUN_DIR" ]]; then
  echo "usage: $0 <run-dir>" >&2
  exit 1
fi

MANIFEST_FILE="${MANIFEST_FILE:-${RUN_DIR}/manifest.tsv}"
OUTPUT_FILE="${OUTPUT_FILE:-${RUN_DIR}/report.md}"
ENVIRONMENT="${ENVIRONMENT:-local}"
COMMIT_SHA="${COMMIT_SHA:-$(git rev-parse --short HEAD 2>/dev/null || echo unknown)}"
JQ_BIN="${JQ_BIN:-jq}"

if [[ ! -f "$MANIFEST_FILE" ]]; then
  echo "missing manifest file: ${MANIFEST_FILE}" >&2
  exit 1
fi

require_bin() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "missing required binary: $1" >&2
    exit 1
  fi
}

require_bin "$JQ_BIN"

format_pct() {
  awk -v value="$1" 'BEGIN { printf "%.2f%%", value * 100 }'
}

format_num() {
  awk -v value="$1" 'BEGIN { printf "%.2f", value + 0 }'
}

metric_count() {
  local file="$1"
  local metric="$2"
  "$JQ_BIN" -r --arg metric "$metric" '.metrics[$metric].count // 0' "$file"
}

metric_value() {
  local file="$1"
  local metric="$2"
  "$JQ_BIN" -r --arg metric "$metric" '.metrics[$metric].value // 0' "$file"
}

latest_metric_value() {
  local metric_name="$1"
  local metrics_files
  local value
  local fallback
  metrics_files="$(find "$RUN_DIR" -maxdepth 1 -name '*-prometheus.ndjson' -printf '%T@ %p\n' | sort -n | cut -d' ' -f2-)"
  if [[ -z "$metrics_files" ]]; then
    printf 'n/a'
    return 0
  fi

  fallback="$(
    while IFS= read -r metrics_file; do
      "$JQ_BIN" -r --arg metric "$metric_name" '
        select(.metric == $metric)
        | .value
      ' "$metrics_file"
    done <<< "$metrics_files" | sed '/^$/d' | tail -n 1 || true
  )"

  value="$(
    while IFS= read -r metrics_file; do
      "$JQ_BIN" -r --arg metric "$metric_name" '
        select(.metric == $metric)
        | .value
      ' "$metrics_file"
    done <<< "$metrics_files" | sed '/^$/d' | grep -v '^NaN$' | tail -n 1 || true
  )"

  if [[ -z "$value" ]]; then
    if [[ -n "$fallback" ]]; then
      printf '%s' "$fallback"
    else
      printf 'n/a'
    fi
    return 0
  fi

  printf '%s' "$value"
}

aggregate_metric_counts() {
  local metric="$1"
  tail -n +2 "$MANIFEST_FILE" | while IFS=$'\t' read -r _phase _source_id _batch_size _request_rate _duration _pre_vus _max_vus _target_msg_per_sec summary_file _log_file; do
    metric_count "$summary_file" "$metric"
  done | awk '{ sum += $1 } END { printf "%.0f", sum + 0 }'
}

aggregate_expected_status_rate() {
  tail -n +2 "$MANIFEST_FILE" | while IFS=$'\t' read -r _phase _source_id _batch_size _request_rate _duration _pre_vus _max_vus _target_msg_per_sec summary_file _log_file; do
    metric_value "$summary_file" ingest_batch_expected_status
  done | awk '{ sum += $1; count += 1 } END { if (count == 0) { printf "0" } else { printf "%.6f", sum / count } }'
}

max_latency() {
  local metric="$1"
  tail -n +2 "$MANIFEST_FILE" | while IFS=$'\t' read -r _phase _source_id _batch_size _request_rate _duration _pre_vus _max_vus _target_msg_per_sec summary_file _log_file; do
    "$JQ_BIN" -r --arg metric "$metric" '
      .metrics[$metric]["p(95)"]
      // .metrics[$metric]["p(99)"]
      // .metrics[$metric].max
      // 0
    ' "$summary_file"
  done | awk 'BEGIN { max = 0 } { if ($1 + 0 > max) max = $1 + 0 } END { printf "%.2f", max }'
}

build_verdict_line() {
  local expected_rate total_5xx total_4xx total_2xx max_p95 storage_failures publish_failures
  expected_rate="$(aggregate_expected_status_rate)"
  total_5xx="$(aggregate_metric_counts ingest_batch_status_5xx)"
  total_4xx="$(aggregate_metric_counts ingest_batch_status_4xx)"
  total_2xx="$(aggregate_metric_counts ingest_batch_status_2xx)"
  max_p95="$(max_latency http_req_duration)"
  storage_failures="$(latest_metric_value storage_batch_failures_5m)"
  publish_failures="$(latest_metric_value ingestion_publish_failed_rate)"

  if awk -v rate="$expected_rate" -v failures="$total_5xx" -v storage="$storage_failures" '
    BEGIN { exit !(rate >= 0.999999 && failures == 0 && storage == 0) }
  '; then
    printf 'PASS - expected-status avg %s, total 2xx=%s, 4xx=%s, 5xx=%s, max p95=%sms' \
      "$(format_pct "$expected_rate")" "$total_2xx" "$total_4xx" "$total_5xx" "$max_p95"
  else
    printf 'FAIL - expected-status avg %s, total 2xx=%s, 4xx=%s, 5xx=%s, max p95=%sms, storage batch failures=%s, ingestion publish fail rate=%s' \
      "$(format_pct "$expected_rate")" "$total_2xx" "$total_4xx" "$total_5xx" "$max_p95" "$storage_failures" "$publish_failures"
  fi
}

build_bottleneck_line() {
  local storage_failures buffer_size alerts
  storage_failures="$(latest_metric_value storage_batch_failures_5m)"
  buffer_size="$(latest_metric_value storage_buffer_size)"
  alerts="$(latest_metric_value alerts_firing)"

  if awk -v failures="$storage_failures" 'BEGIN { exit !(failures > 0) }'; then
    printf 'Storage write path showing failures (%s in last 5m)' "$storage_failures"
    return 0
  fi

  if awk -v buffer="$buffer_size" 'BEGIN { exit !(buffer >= 100000) }'; then
    printf 'Storage buffer reached backpressure threshold (%s)' "$buffer_size"
    return 0
  fi

  if [[ "$alerts" != "0" && "$alerts" != "n/a" ]]; then
    printf 'No throughput bottleneck observed; review %s firing alert(s) separately' "$alerts"
    return 0
  fi

  printf 'No material bottleneck observed in this run'
}

build_follow_up_line() {
  local alerts
  alerts="$(latest_metric_value alerts_firing)"
  if [[ "$alerts" != "0" && "$alerts" != "n/a" ]]; then
    printf 'Inspect active Prometheus alert(s) and tune alert hygiene if they are unrelated to load acceptance'
    return 0
  fi

  printf 'Promote this bundle as the new performance baseline and keep rerunning after each throughput-sensitive change'
}

{
  printf '# Multi-Source Load Test Report\n\n'
  printf -- '- Date: `%s`\n' "$(date -Iseconds)"
  printf -- '- Commit: `%s`\n' "$COMMIT_SHA"
  printf -- '- Environment: `%s`\n' "$ENVIRONMENT"
  printf -- '- Run dir: `%s`\n\n' "$RUN_DIR"

  printf '## Per-Phase Results\n\n'
  printf '| Phase | Source | Target msg/s | Actual msg/s | Expected-status rate | p95 (ms) | p99 (ms) | 2xx | 4xx | 5xx | 400 | 401 | 413 | 429 | 503 | Dropped iterations |\n'
  printf '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n'

  tail -n +2 "$MANIFEST_FILE" | while IFS=$'\t' read -r phase source_id batch_size request_rate duration pre_vus max_vus target_msg_per_sec summary_file log_file; do
    http_rate="$("$JQ_BIN" -r '.metrics.http_reqs.rate // 0' "$summary_file")"
    expected_rate="$("$JQ_BIN" -r '.metrics.ingest_batch_expected_status.value // 0' "$summary_file")"
    p95="$("$JQ_BIN" -r '.metrics.http_req_duration["p(95)"] // .metrics.http_req_duration["p(90)"] // .metrics.http_req_duration.max // 0' "$summary_file")"
    p99="$("$JQ_BIN" -r '.metrics.http_req_duration["p(99)"] // .metrics.http_req_duration.max // 0' "$summary_file")"
    dropped_iterations="$("$JQ_BIN" -r '.metrics.dropped_iterations.count // 0' "$summary_file")"
    status_2xx="$(metric_count "$summary_file" ingest_batch_status_2xx)"
    status_4xx="$(metric_count "$summary_file" ingest_batch_status_4xx)"
    status_5xx="$(metric_count "$summary_file" ingest_batch_status_5xx)"
    status_400="$(metric_count "$summary_file" ingest_batch_status_400)"
    status_401="$(metric_count "$summary_file" ingest_batch_status_401)"
    status_413="$(metric_count "$summary_file" ingest_batch_status_413)"
    status_429="$(metric_count "$summary_file" ingest_batch_status_429)"
    status_503="$(metric_count "$summary_file" ingest_batch_status_503)"
    actual_msg_per_sec="$(awk -v req_rate="$http_rate" -v batch="$batch_size" 'BEGIN { printf "%.0f", req_rate * batch }')"
    printf '| %s | %s | %s | %s | %s | %s | %s | %s | %s | %s | %s | %s | %s | %s | %s | %s |\n' \
      "$phase" "$source_id" "$target_msg_per_sec" "$actual_msg_per_sec" "$(format_pct "$expected_rate")" \
      "$(format_num "$p95")" "$(format_num "$p99")" "$status_2xx" "$status_4xx" "$status_5xx" \
      "$status_400" "$status_401" "$status_413" "$status_429" "$status_503" "$dropped_iterations"
  done

  printf '\n## Pipeline Metrics Snapshot\n\n'
  printf '| Metric | Latest value |\n'
  printf '|---|---|\n'
  printf '| ingestion records rate | %s |\n' "$(latest_metric_value ingestion_records_rate)"
  printf '| ingestion publish rate | %s |\n' "$(latest_metric_value ingestion_publish_rate)"
  printf '| ingestion admission reject rate | %s |\n' "$(latest_metric_value ingestion_admission_reject_rate)"
  printf '| processing pipeline p95 | %s |\n' "$(latest_metric_value processing_pipeline_p95)"
  printf '| processing DLQ rate | %s |\n' "$(latest_metric_value processing_dlq_rate)"
  printf '| ingestion publish failed rate | %s |\n' "$(latest_metric_value ingestion_publish_failed_rate)"
  printf '| storage batch p95 | %s |\n' "$(latest_metric_value storage_batch_p95)"
  printf '| storage buffer size | %s |\n' "$(latest_metric_value storage_buffer_size)"
  printf '| storage batch failures (5m) | %s |\n' "$(latest_metric_value storage_batch_failures_5m)"
  printf '| ws sessions active | %s |\n' "$(latest_metric_value ws_sessions_active)"
  printf '| ws push p95 | %s |\n' "$(latest_metric_value ws_push_p95)"
  printf '| firing alerts | %s |\n' "$(latest_metric_value alerts_firing)"

  printf '\n## Verdict\n\n'
  printf -- '- PASS / FAIL: %s\n' "$(build_verdict_line)"
  printf -- '- Bottleneck: %s\n' "$(build_bottleneck_line)"
  printf -- '- Follow-up: %s\n' "$(build_follow_up_line)"
} > "$OUTPUT_FILE"

echo "report written to ${OUTPUT_FILE}"
