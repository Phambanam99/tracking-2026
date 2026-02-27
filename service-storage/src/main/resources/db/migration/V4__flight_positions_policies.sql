ALTER TABLE flight_positions SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'icao',
    timescaledb.compress_orderby = 'event_time DESC'
);

SELECT public.add_compression_policy('flight_positions', INTERVAL '7 days', if_not_exists => TRUE);
SELECT public.add_retention_policy('flight_positions', INTERVAL '90 days', if_not_exists => TRUE);
