-- Classification results for domain events
-- One row per domain_event; populated by the classify worker.
CREATE TABLE IF NOT EXISTS domain_classifications (
    id              BIGSERIAL PRIMARY KEY,
    domain_event_id BIGINT NOT NULL REFERENCES domain_events(id) ON DELETE CASCADE,
    classified_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- DNS check
    dns_resolves    BOOLEAN NOT NULL DEFAULT false,

    -- HTTP check
    http_status     INT,
    page_title      TEXT,

    -- Content classification (rule-based)
    has_business_content BOOLEAN NOT NULL DEFAULT false,
    has_pricing     BOOLEAN NOT NULL DEFAULT false,
    has_team_page   BOOLEAN NOT NULL DEFAULT false,
    has_contact_page BOOLEAN NOT NULL DEFAULT false,
    has_about_page  BOOLEAN NOT NULL DEFAULT false,
    is_parked       BOOLEAN NOT NULL DEFAULT false,
    domain_age_days INT,

    -- LLM gate (only for promising candidates)
    llm_score       REAL,
    llm_reasoning   TEXT,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One classification per domain event
CREATE UNIQUE INDEX IF NOT EXISTS idx_domain_classifications_event
    ON domain_classifications (domain_event_id);

-- For the API: find leads (business content, not parked, has LLM score)
CREATE INDEX IF NOT EXISTS idx_domain_classifications_leads
    ON domain_classifications (llm_score DESC NULLS LAST, classified_at DESC)
    WHERE has_business_content = true AND is_parked = false;

-- For the LLM gate: find domains that need LLM scoring
CREATE INDEX IF NOT EXISTS idx_domain_classifications_llm_pending
    ON domain_classifications (dns_resolves, is_parked, llm_score NULLS FIRST)
    WHERE llm_score IS NULL;
