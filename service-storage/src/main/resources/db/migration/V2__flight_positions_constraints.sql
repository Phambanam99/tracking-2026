CREATE UNIQUE INDEX IF NOT EXISTS uq_flight_positions_dedup
ON flight_positions (icao, event_time, lat, lon);
