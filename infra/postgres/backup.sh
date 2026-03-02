#!/usr/bin/env bash
set -euo pipefail

PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGDATABASE="${PGDATABASE:-tracking}"
PGUSER="${PGUSER:-tracking}"
PGPASSWORD_VALUE="${PGPASSWORD:-tracking}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-tracking-postgres}"
TIMESTAMP="$(date -u +%Y%m%d-%H%M%S)"
OUTPUT_FILE="${OUTPUT_FILE:-${BACKUP_DIR}/${PGDATABASE}-${TIMESTAMP}.dump}"

mkdir -p "${BACKUP_DIR}"

run_host_backup() {
  PGPASSWORD="${PGPASSWORD_VALUE}" pg_dump \
    --host "${PGHOST}" \
    --port "${PGPORT}" \
    --username "${PGUSER}" \
    --dbname "${PGDATABASE}" \
    --format=custom \
    --file "${OUTPUT_FILE}"
}

run_container_backup() {
  docker exec \
    --env "PGPASSWORD=${PGPASSWORD_VALUE}" \
    "${POSTGRES_CONTAINER}" \
    pg_dump \
      --username "${PGUSER}" \
      --dbname "${PGDATABASE}" \
      --format=custom \
      > "${OUTPUT_FILE}"
}

if command -v pg_dump >/dev/null 2>&1; then
  run_host_backup
else
  run_container_backup
fi

echo "Backup written to ${OUTPUT_FILE}"
