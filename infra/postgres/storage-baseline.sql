-- Storage baseline queries for TimescaleDB / PostgreSQL.
-- Run with:
--   psql -U tracking -d tracking -f infra/postgres/storage-baseline.sql

\echo '== storage.flight_positions size =='
SELECT
    pg_size_pretty(pg_relation_size('storage.flight_positions')) AS table_size,
    pg_size_pretty(pg_indexes_size('storage.flight_positions')) AS indexes_size,
    pg_size_pretty(pg_total_relation_size('storage.flight_positions')) AS total_size;

\echo '== estimated rows and bytes per row =='
SELECT
    c.reltuples::bigint AS estimated_rows,
    CASE
        WHEN c.reltuples > 0 THEN round(pg_total_relation_size(c.oid) / c.reltuples)
        ELSE NULL
    END AS estimated_bytes_per_row
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'storage'
  AND c.relname = 'flight_positions';

\echo '== rows per day (last 14 days) =='
SELECT
    date_trunc('day', event_time) AS day_bucket,
    COUNT(*) AS rows_written
FROM storage.flight_positions
WHERE event_time >= now() - interval '14 days'
GROUP BY 1
ORDER BY 1 DESC;

\echo '== rows per source per day (last 7 days) =='
SELECT
    date_trunc('day', event_time) AS day_bucket,
    source_id,
    COUNT(*) AS rows_written
FROM storage.flight_positions
WHERE event_time >= now() - interval '7 days'
GROUP BY 1, 2
ORDER BY 1 DESC, 3 DESC;

\echo '== latest chunks and compression status =='
SELECT
    chunk_schema || '.' || chunk_name AS chunk_name,
    range_start,
    range_end,
    is_compressed
FROM timescaledb_information.chunks
WHERE hypertable_schema = 'storage'
  AND hypertable_name = 'flight_positions'
ORDER BY range_start DESC
LIMIT 20;

\echo '== indexes on storage.flight_positions =='
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'storage'
  AND tablename = 'flight_positions'
ORDER BY indexname;

\echo '== optional: recent heavy queries from pg_stat_statements =='
-- Uncomment if pg_stat_statements is enabled.
-- SELECT
--     calls,
--     total_exec_time,
--     mean_exec_time,
--     rows,
--     query
-- FROM pg_stat_statements
-- WHERE query ILIKE '%flight_positions%'
-- ORDER BY total_exec_time DESC
-- LIMIT 20;
