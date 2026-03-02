#!/usr/bin/env bash
set -euo pipefail

PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-tracking}"
PGPASSWORD_VALUE="${PGPASSWORD:-tracking}"
RESTORE_DB="${RESTORE_DB:-tracking_restore}"
BACKUP_FILE="${BACKUP_FILE:-}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-tracking-postgres}"

if [[ -z "${BACKUP_FILE}" ]]; then
  echo "BACKUP_FILE is required" >&2
  exit 1
fi

if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo "Backup file not found: ${BACKUP_FILE}" >&2
  exit 1
fi

if [[ ! "${RESTORE_DB}" =~ ^[A-Za-z0-9_]+$ ]]; then
  echo "RESTORE_DB must match ^[A-Za-z0-9_]+$" >&2
  exit 1
fi

drop_and_create_host_db() {
  PGPASSWORD="${PGPASSWORD_VALUE}" psql \
    --host "${PGHOST}" \
    --port "${PGPORT}" \
    --username "${PGUSER}" \
    --dbname postgres \
    --set ON_ERROR_STOP=1 \
    --command "DROP DATABASE IF EXISTS ${RESTORE_DB};"

  PGPASSWORD="${PGPASSWORD_VALUE}" psql \
    --host "${PGHOST}" \
    --port "${PGPORT}" \
    --username "${PGUSER}" \
    --dbname postgres \
    --set ON_ERROR_STOP=1 \
    --command "CREATE DATABASE ${RESTORE_DB};"
}

restore_host_db() {
  PGPASSWORD="${PGPASSWORD_VALUE}" pg_restore \
    --host "${PGHOST}" \
    --port "${PGPORT}" \
    --username "${PGUSER}" \
    --dbname "${RESTORE_DB}" \
    --clean \
    --if-exists \
    --no-owner \
    "${BACKUP_FILE}"
}

drop_and_create_container_db() {
  docker exec \
    --env "PGPASSWORD=${PGPASSWORD_VALUE}" \
    "${POSTGRES_CONTAINER}" \
    psql \
      --username "${PGUSER}" \
      --dbname postgres \
      --set ON_ERROR_STOP=1 \
      --command "DROP DATABASE IF EXISTS ${RESTORE_DB};"

  docker exec \
    --env "PGPASSWORD=${PGPASSWORD_VALUE}" \
    "${POSTGRES_CONTAINER}" \
    psql \
      --username "${PGUSER}" \
      --dbname postgres \
      --set ON_ERROR_STOP=1 \
      --command "CREATE DATABASE ${RESTORE_DB};"
}

restore_container_db() {
  cat "${BACKUP_FILE}" | docker exec -i \
    --env "PGPASSWORD=${PGPASSWORD_VALUE}" \
    "${POSTGRES_CONTAINER}" \
    pg_restore \
      --username "${PGUSER}" \
      --dbname "${RESTORE_DB}" \
      --clean \
      --if-exists \
      --no-owner
}

if command -v psql >/dev/null 2>&1 && command -v pg_restore >/dev/null 2>&1; then
  drop_and_create_host_db
  restore_host_db
else
  drop_and_create_container_db
  restore_container_db
fi

echo "Restore completed into database ${RESTORE_DB}"
