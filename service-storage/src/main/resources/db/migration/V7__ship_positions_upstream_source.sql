ALTER TABLE ship_positions
    ADD COLUMN IF NOT EXISTS upstream_source VARCHAR(128) NULL;

