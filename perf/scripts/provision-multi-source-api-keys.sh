#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

SOURCES_FILE="${SOURCES_FILE:-perf/config/multi-source-sources.json}"
OUTPUT_JSON="${OUTPUT_JSON:-perf/.generated/multi-source-api-keys.json}"
OUTPUT_ENV="${OUTPUT_ENV:-perf/.generated/multi-source-api-keys.env}"
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-http://localhost:8080}"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin@12345678}"
JQ_BIN="${JQ_BIN:-jq}"

mkdir -p "$(dirname "$OUTPUT_JSON")"

require_bin() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "missing required binary: $1" >&2
    exit 1
  fi
}

require_bin curl
require_bin "$JQ_BIN"

login_payload="$(printf '{"username":"%s","password":"%s"}' "$ADMIN_USERNAME" "$ADMIN_PASSWORD")"
login_response="$(
  curl -fsS -X POST "${PUBLIC_BASE_URL}/api/v1/auth/login" \
    -H 'Content-Type: application/json' \
    -d "$login_payload"
)"
access_token="$(printf '%s' "$login_response" | "$JQ_BIN" -r '.accessToken // empty')"

if [[ -z "$access_token" ]]; then
  echo "failed to obtain access token from ${PUBLIC_BASE_URL}/api/v1/auth/login" >&2
  echo "response=${login_response}" >&2
  exit 1
fi

json_items=()
env_lines=()

while IFS= read -r source_id; do
  response="$(
    curl -fsS -X POST "${PUBLIC_BASE_URL}/api/v1/auth/api-keys" \
      -H "Authorization: Bearer ${access_token}" \
      -H 'Content-Type: application/json' \
      -d "{\"sourceId\":\"${source_id}\"}"
  )"

  api_key_id="$(printf '%s' "$response" | "$JQ_BIN" -r '.id // empty')"
  api_key_value="$(printf '%s' "$response" | "$JQ_BIN" -r '.apiKey // empty')"

  if [[ -z "$api_key_id" || -z "$api_key_value" ]]; then
    echo "failed to create api key for ${source_id}" >&2
    echo "response=${response}" >&2
    exit 1
  fi

  env_name="API_KEY_$(printf '%s' "$source_id" | tr '[:lower:]-' '[:upper:]_')"
  env_lines+=("${env_name}=${api_key_value}")
  json_items+=("{\"sourceId\":\"${source_id}\",\"id\":${api_key_id},\"apiKey\":\"${api_key_value}\"}")
done < <("$JQ_BIN" -r '.sources[].sourceId' "$SOURCES_FILE")

{
  printf '{\n'
  printf '  "generatedAt": "%s",\n' "$(date -Iseconds)"
  printf '  "publicBaseUrl": "%s",\n' "$PUBLIC_BASE_URL"
  printf '  "keys": [\n'
  for index in "${!json_items[@]}"; do
    suffix=","
    if [[ "$index" == "$((${#json_items[@]} - 1))" ]]; then
      suffix=""
    fi
    printf '    %s%s\n' "${json_items[$index]}" "$suffix"
  done
  printf '  ]\n'
  printf '}\n'
} > "$OUTPUT_JSON"

{
  printf '# generatedAt=%s\n' "$(date -Iseconds)"
  printf 'PUBLIC_BASE_URL=%s\n' "$PUBLIC_BASE_URL"
  printf 'API_KEYS_JSON=%s\n' "$OUTPUT_JSON"
  for line in "${env_lines[@]}"; do
    printf '%s\n' "$line"
  done
} > "$OUTPUT_ENV"

echo "api keys written to ${OUTPUT_JSON}"
echo "env file written to ${OUTPUT_ENV}"
