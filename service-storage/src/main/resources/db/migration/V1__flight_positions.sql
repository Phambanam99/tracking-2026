CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS flight_positions (
    id BIGSERIAL,
    icao TEXT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lon DOUBLE PRECISION NOT NULL,
    altitude INTEGER,
    speed DOUBLE PRECISION,
    heading DOUBLE PRECISION,
    event_time BIGINT NOT NULL,
    source_id TEXT NOT NULL,
    is_historical BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (event_time, id)
);

SELECT create_hypertable(
    'flight_positions',
    by_range('event_time'),
    if_not_exists => TRUE
);
