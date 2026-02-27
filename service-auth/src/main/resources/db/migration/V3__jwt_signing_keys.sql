CREATE TABLE IF NOT EXISTS jwt_signing_keys (
    kid VARCHAR(100) PRIMARY KEY,
    private_key_der_base64 TEXT NOT NULL,
    public_key_der_base64 TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    retired_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_jwt_signing_keys_active
    ON jwt_signing_keys (active)
    WHERE active = TRUE;
