#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

PHASE="${1:-${PHASE:-warmup}}"
SOURCES_FILE="${SOURCES_FILE:-perf/config/multi-source-sources.json}"
API_KEYS_FILE="${API_KEYS_FILE:-perf/.generated/multi-source-api-keys.json}"
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-http://localhost:8080}"
REPORT_ROOT="${REPORT_ROOT:-perf/reports}"
RUN_ID="${RUN_ID:-multi-source-$(date +%Y%m%d-%H%M%S)}"
RUN_DIR="${REPORT_ROOT}/${RUN_ID}"
PROMETHEUS_BASE_URL="${PROMETHEUS_BASE_URL:-http://localhost:9090}"
PROM_INTERVAL_SECONDS="${PROM_INTERVAL_SECONDS:-60}"
START_PROM_POLLING="${START_PROM_POLLING:-1}"
DRY_RUN="${DRY_RUN:-0}"
K6_DOCKER_IMAGE="${K6_DOCKER_IMAGE:-grafana/k6:0.49.0}"

case "$PHASE" in
  warmup|ramp|sustained|peak) ;;
  *)
    echo "unsupported phase: ${PHASE}" >&2
    exit 1
    ;;
esac

require_bin() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "missing required binary: $1" >&2
    exit 1
  fi
}

require_bin jq

mkdir -p "$RUN_DIR"
manifest_file="${RUN_DIR}/manifest.tsv"
if [[ ! -f "$manifest_file" ]]; then
  printf 'phase\tsourceId\tbatchSize\trequestRate\tduration\tpreAllocatedVus\tmaxVus\ttargetMsgPerSec\tsummaryFile\tlogFile\n' > "$manifest_file"
fi

duration_to_seconds() {
  local value="$1"
  local amount unit
  amount="${value%[smhd]}"
  unit="${value#$amount}"
  case "$unit" in
    s) printf '%s' "$amount" ;;
    m) printf '%s' "$((amount * 60))" ;;
    h) printf '%s' "$((amount * 3600))" ;;
    d) printf '%s' "$((amount * 86400))" ;;
    *)
      echo "unsupported duration: ${value}" >&2
      exit 1
      ;;
  esac
}

k6_mode="local"
if ! command -v k6 >/dev/null 2>&1; then
  require_bin docker
  k6_mode="docker"
fi

if [[ ! -f "$API_KEYS_FILE" ]]; then
  echo "missing API_KEYS_FILE=${API_KEYS_FILE}. Run perf/scripts/provision-multi-source-api-keys.sh first." >&2
  exit 1
fi

if [[ "$PHASE" == "warmup" ]]; then
  source_filter='[.sources[0]]'
else
  source_filter='.sources'
fi

phase_duration="$(
  jq -r --arg phase "$PHASE" "$source_filter | map(.phases[\$phase].duration) | first" "$SOURCES_FILE"
)"
phase_duration="${DURATION_OVERRIDE:-$phase_duration}"
phase_seconds="$(duration_to_seconds "$phase_duration")"
poller_pid=""
if [[ "$START_PROM_POLLING" == "1" ]]; then
  OUTPUT_FILE="${RUN_DIR}/${PHASE}-prometheus.ndjson" \
  PROMETHEUS_BASE_URL="$PROMETHEUS_BASE_URL" \
  INTERVAL_SECONDS="$PROM_INTERVAL_SECONDS" \
  DURATION_SECONDS="$((phase_seconds + PROM_INTERVAL_SECONDS))" \
  perf/scripts/poll-prometheus.sh &
  poller_pid=$!
fi

cleanup() {
  if [[ -n "$poller_pid" ]]; then
    kill "$poller_pid" >/dev/null 2>&1 || true
    wait "$poller_pid" >/dev/null 2>&1 || true
    poller_pid=""
  fi
}

trap cleanup EXIT INT TERM

declare -a pids=()
declare -a labels=()

while IFS=$'\t' read -r source_id batch_size request_rate duration pre_vus max_vus base_lat base_lon icao_offset; do
  batch_size="${BATCH_SIZE:-$batch_size}"
  request_rate="${REQUEST_RATE_OVERRIDE:-$request_rate}"
  duration="${DURATION_OVERRIDE:-$duration}"
  pre_vus="${PRE_ALLOCATED_VUS_OVERRIDE:-$pre_vus}"
  max_vus="${MAX_VUS_OVERRIDE:-$max_vus}"
  base_lat="${BASE_LAT_OVERRIDE:-$base_lat}"
  base_lon="${BASE_LON_OVERRIDE:-$base_lon}"
  icao_offset="${ICAO_OFFSET_OVERRIDE:-$icao_offset}"

  api_key="$(
    jq -r --arg source_id "$source_id" '.keys[] | select(.sourceId == $source_id) | .apiKey' "$API_KEYS_FILE"
  )"
  if [[ -z "$api_key" ]]; then
    echo "missing API key for ${source_id} in ${API_KEYS_FILE}" >&2
    exit 1
  fi

  summary_file="${RUN_DIR}/${PHASE}-${source_id}.summary.json"
  log_file="${RUN_DIR}/${PHASE}-${source_id}.log"
  target_msg_per_sec="$((batch_size * request_rate))"

  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
    "$PHASE" "$source_id" "$batch_size" "$request_rate" "$duration" "$pre_vus" "$max_vus" \
    "$target_msg_per_sec" "$summary_file" "$log_file" >> "$manifest_file"

  env_args=(
    "BASE_URL=${PUBLIC_BASE_URL}"
    "API_KEY=${api_key}"
    "SOURCE_ID=${source_id}"
    "BODY_SOURCE_ID=${BODY_SOURCE_ID_OVERRIDE:-$source_id}"
    "BATCH_SIZE=${batch_size}"
    "REQUEST_RATE=${request_rate}"
    "DURATION=${duration}"
    "PRE_ALLOCATED_VUS=${pre_vus}"
    "MAX_VUS=${max_vus}"
    "BASE_LAT=${base_lat}"
    "BASE_LON=${base_lon}"
    "ICAO_OFFSET=${icao_offset}"
  )

  optional_envs=(
    THINK_TIME_MS
    HISTORICAL_RATIO
    DUPLICATE_RATIO
    INVALID_RATIO
    FUTURE_EVENT_RATIO
    SOURCE_ID_MISMATCH_RATIO
    HISTORICAL_SKEW_MS
    FUTURE_EVENT_SKEW_MS
    INVALID_MODE
    SPOOFED_BODY_SOURCE_ID
    ACCEPTED_STATUS_CODES
    INGEST_PATH
    LAT_JITTER
    LON_JITTER
  )
  for env_name in "${optional_envs[@]}"; do
    if [[ -n "${!env_name:-}" ]]; then
      env_args+=("${env_name}=${!env_name}")
    fi
  done

  if [[ "$DRY_RUN" == "1" ]]; then
    if [[ "$k6_mode" == "local" ]]; then
      printf '%s ' "${env_args[@]}"
      printf 'k6 run --summary-export %q perf/k6/ingestion-load.js\n' "$summary_file"
    else
      printf 'docker run --rm --network host -v %q:/work -w /work ' "$ROOT_DIR"
      for env_pair in "${env_args[@]}"; do
        printf -- '-e %q ' "$env_pair"
      done
      printf '%q run --summary-export %q perf/k6/ingestion-load.js\n' "$K6_DOCKER_IMAGE" "$summary_file"
    fi
    continue
  fi

  if [[ "$k6_mode" == "local" ]]; then
    (
      export "${env_args[@]}"
      k6 run --summary-export "$summary_file" perf/k6/ingestion-load.js
    ) >"$log_file" 2>&1 &
  else
    docker_cmd=(docker run --rm --network host -v "$ROOT_DIR:/work" -w /work)
    for env_pair in "${env_args[@]}"; do
      docker_cmd+=(-e "$env_pair")
    done
    docker_cmd+=("$K6_DOCKER_IMAGE" run --summary-export "$summary_file" perf/k6/ingestion-load.js)
    "${docker_cmd[@]}" >"$log_file" 2>&1 &
  fi

  pids+=("$!")
  labels+=("${source_id}")
done < <(
  jq -r --arg phase "$PHASE" "
    ${source_filter}
    | .[]
    | [
        .sourceId,
        .batchSize,
        .phases[\$phase].requestRate,
        .phases[\$phase].duration,
        .phases[\$phase].preAllocatedVus,
        .phases[\$phase].maxVus,
        .baseLat,
        .baseLon,
        .icaoOffset
      ]
    | @tsv
  " "$SOURCES_FILE"
)

if [[ "$DRY_RUN" == "1" ]]; then
  cleanup
  exit 0
fi

status=0
for index in "${!pids[@]}"; do
  if ! wait "${pids[$index]}"; then
    echo "phase=${PHASE} source=${labels[$index]} failed; see ${RUN_DIR}/${PHASE}-${labels[$index]}.log" >&2
    status=1
  fi
done

cleanup

exit "$status"
