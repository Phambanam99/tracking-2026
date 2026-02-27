CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS flight_positions (
    icao VARCHAR(6) NOT NULL,
    event_time TIMESTAMPTZ NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lon DOUBLE PRECISION NOT NULL,
    altitude DOUBLE PRECISION,
    speed DOUBLE PRECISION,
    heading DOUBLE PRECISION,
    source_id VARCHAR(64),
    is_historical BOOLEAN NOT NULL DEFAULT FALSE,
    metadata JSONB,
    request_id VARCHAR(128),
    traceparent VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

SELECT create_hypertable(
    'flight_positions',
    by_range('event_time', INTERVAL '1 day'),
    if_not_exists => TRUE
);

CREATE INDEX IF NOT EXISTS idx_fp_icao_time
ON flight_positions (icao, event_time DESC);

CREATE INDEX IF NOT EXISTS idx_fp_latlon
ON flight_positions (lat, lon);

ALTER TABLE flight_positions SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'icao',
    timescaledb.compress_orderby = 'event_time DESC'
);

SELECT add_compression_policy('flight_positions', INTERVAL '7 days', if_not_exists => TRUE);
SELECT add_retention_policy('flight_positions', INTERVAL '90 days', if_not_exists => TRUE);
