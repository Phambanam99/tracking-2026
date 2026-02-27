CREATE UNIQUE INDEX IF NOT EXISTS uq_flight_positions_dedup
ON flight_positions (icao, lat, lon, event_time, source_id);

CREATE INDEX IF NOT EXISTS idx_flight_positions_lookup
ON flight_positions (icao, event_time DESC);
