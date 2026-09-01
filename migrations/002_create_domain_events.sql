-- Domain events from certstream / CT logs
-- This is the core ingestion table. Certificates become domain events.
CREATE TABLE IF NOT EXISTS domain_events (
    id              BIGSERIAL PRIMARY KEY,
    cert_fingerprint TEXT NOT NULL,
    registrable_domain TEXT NOT NULL,
    log_id          TEXT,
    leaf_index      BIGINT,
    san_entries     TEXT[] DEFAULT '{}',
    not_before      TIMESTAMPTZ,
    not_after       TIMESTAMPTZ,
    issuer          TEXT,
    source          TEXT NOT NULL DEFAULT 'certstream',
    first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_classified_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency: same cert + same domain = update last_seen, don't duplicate
CREATE UNIQUE INDEX IF NOT EXISTS idx_domain_events_fingerprint_domain
    ON domain_events (cert_fingerprint, registrable_domain);

-- Lookup by domain for the API
CREATE INDEX IF NOT EXISTS idx_domain_events_registrable_domain
    ON domain_events (registrable_domain);

-- For the classifier worker: find unclassified domains
CREATE INDEX IF NOT EXISTS idx_domain_events_unclassified
    ON domain_events (last_classified_at NULLS FIRST, first_seen_at DESC)
    WHERE last_classified_at IS NULL;

-- Partition hint: registrable_domain prefix for sharding
CREATE INDEX IF NOT EXISTS idx_domain_events_domain_prefix
    ON domain_events (left(registrable_domain, 3));
