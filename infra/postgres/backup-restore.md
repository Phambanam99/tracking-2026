# PostgreSQL/Timescale Backup & Restore

## Objectives
- Support daily full backup and point-in-time recovery (PITR) for production.
- Keep restore procedure deterministic and testable.
- Validate Timescale hypertables, indexes, and storage pipeline after restore.

## Backup strategy

### Local / dev
- Full logical backup via custom format `pg_dump -Fc`.
- Script: `infra/postgres/backup.sh`

### Production baseline
- Daily full backup retained for `14` days.
- WAL archiving retained for `7` days to support PITR.
- Recommended tooling:
  - `pgBackRest` or `WAL-G` for continuous archiving
  - object storage with immutable retention
  - checksum validation after upload

## Backup commands

### Host client path
```bash
PGPASSWORD=tracking ./infra/postgres/backup.sh
```

### Docker fallback
```bash
BACKUP_DIR=./backups PGPASSWORD=tracking ./infra/postgres/backup.sh
```

## Restore drill

### Restore command
```bash
BACKUP_FILE=./backups/tracking-20260301-101500.dump \
RESTORE_DB=tracking_restore \
PGPASSWORD=tracking \
./infra/postgres/restore.sh
```

### Validation steps
1. Verify schemas and Flyway history:
```sql
\dn
SELECT installed_rank, version, success FROM auth.flyway_schema_history_auth ORDER BY installed_rank DESC LIMIT 5;
SELECT installed_rank, version, success FROM storage.flyway_schema_history_storage ORDER BY installed_rank DESC LIMIT 5;
```
2. Verify Timescale extension and hypertable:
```sql
SELECT extname FROM pg_extension WHERE extname = 'timescaledb';
SELECT hypertable_name FROM timescaledb_information.hypertables WHERE hypertable_name = 'flight_positions';
```
3. Verify indexes:
```sql
SELECT indexname FROM pg_indexes WHERE schemaname = 'storage' AND tablename = 'flight_positions';
```
4. Verify row counts and sample recent data:
```sql
SELECT COUNT(*) FROM storage.flight_positions;
SELECT icao, event_time FROM storage.flight_positions ORDER BY event_time DESC LIMIT 10;
```
5. Run storage smoke test after restore:
   - start `service-storage`
   - replay small `live-adsb` / `historical-adsb` sample
   - verify no duplicate rows, no batch failure

## Monitoring
- Backup job must emit:
  - last successful backup timestamp
  - backup size
  - checksum / integrity result
  - archive upload status
- Alert if:
  - no successful backup in `> 26h`
  - WAL archiving fails for `> 15m`
  - restore drill older than `30d`

## Retention
- Daily logical backups: `14d`
- Weekly full backup: `8w`
- Monthly snapshot: `6m`
- WAL archive: `7d`

## Disaster recovery notes
- Keep at least one off-cluster backup copy.
- Restore test must be executed in isolated DB name (`tracking_restore`) before production promotion.
- Do not overwrite primary DB during drill.
