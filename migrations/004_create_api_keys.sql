-- API keys for the freemium API (Phase 2)
CREATE TABLE IF NOT EXISTS api_keys (
    id              BIGSERIAL PRIMARY KEY,
    key_hash        TEXT NOT NULL UNIQUE,  -- SHA-256 of the API key
    name            TEXT NOT NULL,
    tier            TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro')),
    usage_count     BIGINT NOT NULL DEFAULT 0,
    usage_limit     BIGINT NOT NULL DEFAULT 500,
    period_start    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash
    ON api_keys (key_hash);
