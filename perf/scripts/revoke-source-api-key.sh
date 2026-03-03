#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

SOURCE_ID="${1:-${SOURCE_ID:-}}"
if [[ -z "$SOURCE_ID" ]]; then
  echo "usage: $0 <source-id>" >&2
  exit 1
fi

PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-http://localhost:8080}"
API_KEYS_FILE="${API_KEYS_FILE:-perf/.generated/multi-source-api-keys.json}"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin@12345678}"
JQ_BIN="${JQ_BIN:-jq}"

require_bin() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "missing required binary: $1" >&2
    exit 1
  fi
}

require_bin curl
require_bin "$JQ_BIN"

if [[ ! -f "$API_KEYS_FILE" ]]; then
  echo "missing API_KEYS_FILE=${API_KEYS_FILE}. Run perf/scripts/provision-multi-source-api-keys.sh first." >&2
  exit 1
fi

target_id="$("$JQ_BIN" -r --arg source_id "$SOURCE_ID" '.keys[] | select(.sourceId == $source_id) | .id' "$API_KEYS_FILE")"
if [[ -z "$target_id" ]]; then
  echo "no API key found for SOURCE_ID=${SOURCE_ID} in ${API_KEYS_FILE}" >&2
  exit 1
fi

login_payload="$(printf '{"username":"%s","password":"%s"}' "$ADMIN_USERNAME" "$ADMIN_PASSWORD")"
login_response="$(
  curl -fsS -X POST "${PUBLIC_BASE_URL}/api/v1/auth/login" \
    -H 'Content-Type: application/json' \
    -d "$login_payload"
)"
access_token="$(printf '%s' "$login_response" | "$JQ_BIN" -r '.accessToken // empty')"
if [[ -z "$access_token" ]]; then
  echo "failed to obtain admin access token" >&2
  echo "response=${login_response}" >&2
  exit 1
fi

response_file="$(mktemp)"
status_code="$(
  curl -sS -o "$response_file" -w '%{http_code}' \
    -X POST "${PUBLIC_BASE_URL}/api/v1/auth/api-keys/${target_id}/revoke" \
    -H "Authorization: Bearer ${access_token}"
)"

if [[ "$status_code" != "204" ]]; then
  echo "failed to revoke api key: sourceId=${SOURCE_ID} id=${target_id} status=${status_code}" >&2
  cat "$response_file" >&2
  rm -f "$response_file"
  exit 1
fi

rm -f "$response_file"
echo "revoked sourceId=${SOURCE_ID} apiKeyId=${target_id}"
