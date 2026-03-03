-- Migration V5: Add lockout and audit fields to users table
ALTER TABLE users ADD COLUMN
IF NOT EXISTS failed_login_attempts INT DEFAULT 0 NOT NULL;
ALTER TABLE users ADD COLUMN
IF NOT EXISTS locked_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN
IF NOT EXISTS last_login_at TIMESTAMPTZ;
