CREATE TABLE IF NOT EXISTS flight_positions_quarantine (
    id BIGSERIAL PRIMARY KEY,
    raw_payload TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
