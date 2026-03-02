#!/usr/bin/env bash
set -euo pipefail

GATEWAY_URL="${GATEWAY_URL:-http://localhost:18080}"
ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin@12345678}"
SOURCE_ID="${SOURCE_ID:-RADAR-FEED}"
ICAO="${ICAO:-ABC123}"

api_key=""
counter=0

refresh_api_key() {
  local admin_login_resp admin_access api_key_resp
  admin_login_resp=$(curl -sS -X POST "${GATEWAY_URL}/api/v1/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"${ADMIN_USER}\",\"password\":\"${ADMIN_PASSWORD}\"}")
  admin_access=$(echo "${admin_login_resp}" | jq -r '.accessToken // empty')
  if [[ -z "${admin_access}" ]]; then
    echo "[feeder] failed admin login response=${admin_login_resp}" >&2
    return 1
  fi

  api_key_resp=$(curl -sS -X POST "${GATEWAY_URL}/api/v1/auth/api-keys" \
    -H "Authorization: Bearer ${admin_access}" \
    -H 'Content-Type: application/json' \
    -d "{\"sourceId\":\"${SOURCE_ID}\"}")
  api_key=$(echo "${api_key_resp}" | jq -r '.apiKey // empty')
  if [[ -z "${api_key}" ]]; then
    echo "[feeder] failed create api key response=${api_key_resp}" >&2
    return 1
  fi

  echo "[feeder] api key refreshed sourceId=${SOURCE_ID}"
  return 0
}

while true; do
  if [[ -z "${api_key}" ]]; then
    refresh_api_key || {
      sleep 2
      continue
    }
  fi

  event_time=$(date +%s%3N)
  lat=$(awk -v c="${counter}" 'BEGIN { printf "%.6f", 21.028500 + ((c % 12) * 0.000050) }')
  lon=$(awk -v c="${counter}" 'BEGIN { printf "%.6f", 105.854200 + ((c % 12) * 0.000050) }')

  status=$(curl -s -o /tmp/p8_feeder_last.out -w '%{http_code}' -X POST "${GATEWAY_URL}/api/v1/ingest/adsb" \
    -H 'Content-Type: application/json' \
    -H "x-api-key: ${api_key}" \
    -H "X-Source-Id: ${SOURCE_ID}" \
    -d "{\"icao\":\"${ICAO}\",\"lat\":${lat},\"lon\":${lon},\"event_time\":${event_time},\"source_id\":\"${SOURCE_ID}\"}")

  if [[ "${status}" == "202" ]]; then
    counter=$((counter + 1))
    sleep 1
    continue
  fi

  if [[ "${status}" == "401" || "${status}" == "403" ]]; then
    echo "[feeder] key rejected status=${status}, refreshing..."
    api_key=""
    sleep 1
    continue
  fi

  echo "[feeder] ingest status=${status} body=$(cat /tmp/p8_feeder_last.out)"
  sleep 2
done
