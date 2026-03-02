-- ============================================================
-- Watchlist Groups: mỗi user có nhiều group theo dõi
-- Max 20 groups per user (enforced at application layer)
-- ============================================================
CREATE TABLE IF NOT EXISTS watchlist_groups (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    color       VARCHAR(7)   NOT NULL DEFAULT '#3b82f6',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, name)
);

-- ============================================================
-- Watchlist Entries: aircraft trong group (many-to-many)
-- Max 200 entries per group (enforced at application layer)
-- ============================================================
CREATE TABLE IF NOT EXISTS watchlist_entries (
    id          BIGSERIAL PRIMARY KEY,
    group_id    BIGINT       NOT NULL REFERENCES watchlist_groups(id) ON DELETE CASCADE,
    icao        VARCHAR(6)   NOT NULL,
    note        VARCHAR(500),
    added_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (group_id, icao)
);

CREATE INDEX idx_wg_user  ON watchlist_groups(user_id);
CREATE INDEX idx_we_group ON watchlist_entries(group_id);
CREATE INDEX idx_we_icao  ON watchlist_entries(icao);

-- ============================================================
-- Trigger: auto-update updated_at trên watchlist_groups
-- Postgres không tự update DEFAULT value khi UPDATE
-- ============================================================
CREATE OR REPLACE FUNCTION update_watchlist_group_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_watchlist_groups_updated_at
    BEFORE UPDATE ON watchlist_groups
    FOR EACH ROW EXECUTE FUNCTION update_watchlist_group_timestamp();
