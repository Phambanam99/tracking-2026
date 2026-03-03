CREATE TABLE IF NOT EXISTS ship_positions (
    id BIGSERIAL PRIMARY KEY,
    mmsi VARCHAR(32) NOT NULL,
    event_time TIMESTAMPTZ NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lon DOUBLE PRECISION NOT NULL,
    speed DOUBLE PRECISION NULL,
    course DOUBLE PRECISION NULL,
    heading DOUBLE PRECISION NULL,
    nav_status VARCHAR(128) NULL,
    vessel_name VARCHAR(256) NULL,
    vessel_type VARCHAR(128) NULL,
    imo VARCHAR(32) NULL,
    call_sign VARCHAR(64) NULL,
    destination VARCHAR(256) NULL,
    eta TIMESTAMPTZ NULL,
    source_id VARCHAR(128) NOT NULL,
    is_historical BOOLEAN NOT NULL DEFAULT FALSE,
    score DOUBLE PRECISION NULL,
    metadata JSONB NULL,
    request_id VARCHAR(128) NULL,
    traceparent VARCHAR(256) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_ship_positions_identity
    ON ship_positions (mmsi, event_time, lat, lon);

CREATE INDEX IF NOT EXISTS ix_ship_positions_event_time
    ON ship_positions (event_time DESC);

CREATE INDEX IF NOT EXISTS ix_ship_positions_mmsi_event_time
    ON ship_positions (mmsi, event_time DESC);
