#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

MODE="${1:-${MODE:-duplicates}}"
WINDOW_MINUTES="${WINDOW_MINUTES:-15}"
SOURCE_ID="${SOURCE_ID:-}"
SPOOFED_SOURCE_ID="${SPOOFED_SOURCE_ID:-SPOOFED-SOURCE}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-tracking-postgres}"
POSTGRES_USER="${POSTGRES_USER:-tracking}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-tracking}"
POSTGRES_DB="${POSTGRES_DB:-}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
USE_DOCKER="${USE_DOCKER:-1}"

require_bin() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "missing required binary: $1" >&2
    exit 1
  fi
}

if [[ "$USE_DOCKER" == "1" ]]; then
  require_bin docker
else
  require_bin psql
fi

resolve_postgres_db() {
  if [[ -n "$POSTGRES_DB" ]]; then
    printf '%s' "$POSTGRES_DB"
    return
  fi

  if [[ "$USE_DOCKER" == "1" ]] && docker ps --format '{{.Names}}' | grep -qx 'tracking-e2e-storage'; then
    local datasource_url
    datasource_url="$(
      docker inspect tracking-e2e-storage --format '{{range .Config.Env}}{{println .}}{{end}}' \
        | awk -F= '/^SPRING_DATASOURCE_URL=jdbc:postgresql:\/\// {print $2; exit}'
    )"
    if [[ -n "$datasource_url" ]]; then
      printf '%s' "$datasource_url" | sed -E 's#^jdbc:postgresql://[^/]*/([^?]+)(\?.*)?$#\1#'
      return
    fi
  fi

  printf 'tracking'
}

POSTGRES_DB="$(resolve_postgres_db)"

run_psql() {
  local sql="$1"
  if [[ "$USE_DOCKER" == "1" ]]; then
    docker exec \
      -e PGPASSWORD="$POSTGRES_PASSWORD" \
      "$POSTGRES_CONTAINER" \
      psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -F $'\t' -c "$sql"
    return
  fi

  PGPASSWORD="$POSTGRES_PASSWORD" \
  psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -F $'\t' -c "$sql"
}

case "$MODE" in
  duplicates)
    source_filter=""
    if [[ -n "$SOURCE_ID" ]]; then
      source_filter="and source_id = '${SOURCE_ID}'"
    fi
    run_psql "
      with duplicate_groups as (
        select icao, event_time, lat, lon, count(*) as copies
        from storage.flight_positions
        where created_at >= now() - interval '${WINDOW_MINUTES} minutes'
          ${source_filter}
        group by 1, 2, 3, 4
        having count(*) > 1
      )
      select
        coalesce(count(*), 0) as duplicate_groups,
        coalesce(sum(copies - 1), 0) as duplicate_rows
      from duplicate_groups;
    "
    ;;
  source-spoof)
    if [[ -z "$SOURCE_ID" ]]; then
      echo "SOURCE_ID is required for MODE=source-spoof" >&2
      exit 1
    fi
    run_psql "
      select
        coalesce(sum(case when source_id = '${SOURCE_ID}' then 1 else 0 end), 0) as trusted_rows,
        coalesce(sum(case when source_id = '${SPOOFED_SOURCE_ID}' then 1 else 0 end), 0) as spoofed_rows
      from storage.flight_positions
      where created_at >= now() - interval '${WINDOW_MINUTES} minutes'
        and source_id in ('${SOURCE_ID}', '${SPOOFED_SOURCE_ID}');
    "
    ;;
  historical)
    source_filter=""
    if [[ -n "$SOURCE_ID" ]]; then
      source_filter="and source_id = '${SOURCE_ID}'"
    fi
    run_psql "
      select
        coalesce(sum(case when is_historical then 1 else 0 end), 0) as historical_rows,
        coalesce(sum(case when not is_historical then 1 else 0 end), 0) as live_rows
      from storage.flight_positions
      where created_at >= now() - interval '${WINDOW_MINUTES} minutes'
        ${source_filter};
    "
    ;;
  *)
    echo "unsupported MODE=${MODE}. expected one of: duplicates, source-spoof, historical" >&2
    exit 1
    ;;
esac
