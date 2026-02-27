# PostgreSQL/Timescale Backup & Restore

## Backup
- Full backup hàng ngày: `pg_dump -Fc tracking > tracking.dump`
- WAL archiving cho point-in-time recovery.

## Restore drill
1. Tạo DB trống.
2. `pg_restore -d tracking tracking.dump`
3. Verify hypertable và index.
4. Chạy smoke test storage pipeline.
