CREATE TABLE IF NOT EXISTS quarantine_records (
    id BIGSERIAL PRIMARY KEY,
    icao VARCHAR(6),
    payload JSONB NOT NULL,
    reason VARCHAR(128) NOT NULL,
    source_topic VARCHAR(128) NOT NULL,
    error_message TEXT,
    request_id VARCHAR(128),
    traceparent VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quarantine_records_created_at
ON quarantine_records (created_at DESC);
