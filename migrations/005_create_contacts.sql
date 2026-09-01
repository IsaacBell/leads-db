-- CRM: companies, contacts, social links, deals, and annotations.
-- Multi-tenant: every row has workspace_id.
-- Soft delete: deleted_at IS NULL means active.
-- PII is stored in parameterized queries only — never in docs or agent context.

-- ──────────────────────────────────────────────
-- 1. Companies (standalone table, referenced by contacts and deals)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
    id              BIGSERIAL PRIMARY KEY,
    workspace_id    UUID NOT NULL,
    name            TEXT NOT NULL,
    domain          TEXT,
    description     TEXT,
    industry        TEXT,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

-- Partial unique index: a soft-deleted company name can be re-added as a new row.
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_workspace_name
    ON companies (workspace_id, name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_companies_domain ON companies (domain);

-- ──────────────────────────────────────────────
-- 2. Contacts
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
    id              BIGSERIAL PRIMARY KEY,
    workspace_id    UUID NOT NULL,
    company_id      BIGINT REFERENCES companies(id) ON DELETE SET NULL,

    -- Identity (PII — store here, never in docs or agent context)
    email           TEXT NOT NULL,
    name            TEXT,
    role            TEXT,
    phone           TEXT,
    city            TEXT,
    country         TEXT,
    notes           TEXT,  -- free-text; may contain PII/PHI — handle with care

    -- Pipeline classification (lead = prospect/pipeline; contact = known person)
    contact_type    TEXT NOT NULL DEFAULT 'lead'
        CHECK (contact_type IN ('lead', 'contact')),

    -- Outreach state
    source          TEXT NOT NULL DEFAULT 'api'
        CHECK (source IN ('api', 'web_subscribe', 'manual', 'import')),
    status          TEXT NOT NULL DEFAULT 'new'
        CHECK (status IN ('new', 'contacted', 'qualified', 'unsubscribed', 'customer')),

    -- Timestamps
    first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_contacted_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,

    -- Unique per workspace (multi-tenant). NOTE: NOT partial — a soft-deleted
    -- contact's email still occupies the unique slot, which prevents re-adding
    -- the same address after a soft delete. This is intentional for now
    -- (unsubscribed/deleted addresses should not be silently re-created); revisit
    -- if a "re-subscribe after deletion" flow is needed.
    UNIQUE (workspace_id, email)
);

CREATE INDEX IF NOT EXISTS idx_contacts_workspace ON contacts (workspace_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts (email);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts (status);
CREATE INDEX IF NOT EXISTS idx_contacts_type ON contacts (contact_type);
CREATE INDEX IF NOT EXISTS idx_contacts_active ON contacts (workspace_id)
    WHERE deleted_at IS NULL;

COMMENT ON TABLE contacts IS 'CRM contact records. PII — do not SELECT * in docs or logging.';
COMMENT ON COLUMN contacts.email IS 'PII #6 — email address';
COMMENT ON COLUMN contacts.name IS 'PII #1 — individual name';
COMMENT ON COLUMN contacts.phone IS 'PII #4 — phone number';
COMMENT ON COLUMN contacts.notes IS 'May contain PII/PHI (Safe Harbor #18 catch-all).';
COMMENT ON COLUMN contacts.contact_type IS 'lead = prospect/pipeline; contact = known person.';

-- ──────────────────────────────────────────────
-- 3. Social links (one-to-many: contact → social profiles)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_links (
    id              BIGSERIAL PRIMARY KEY,
    contact_id      BIGINT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    platform        TEXT NOT NULL
        CHECK (platform IN (
            'behance', 'bluesky', 'discord', 'dribbble', 'facebook',
            'github', 'instagram', 'linkedin', 'medium', 'pinterest',
            'snapchat', 'threads', 'tiktok', 'twitch', 'x',
            'website', 'portfolio', 'youtube', 'other'
        )),
    url             TEXT NOT NULL,
    label           TEXT,  -- optional display label, e.g. "Work", "Personal"

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,

    UNIQUE (contact_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_social_links_contact ON social_links (contact_id);
CREATE INDEX IF NOT EXISTS idx_social_links_platform ON social_links (platform);

COMMENT ON TABLE social_links IS 'One-to-many social/ web profiles per contact.';
COMMENT ON COLUMN social_links.url IS 'Safe Harbor #14 — may contain personal URLs';

-- ──────────────────────────────────────────────
-- 4. Deals (sales pipeline opportunities tied to a contact)
-- ──────────────────────────────────────────────
-- A contact may have many deals. Stage is the pipeline state; probability is a
-- 0-100 integer (nullable until scored). source/source_url record provenance.
CREATE TABLE IF NOT EXISTS deals (
    id              BIGSERIAL PRIMARY KEY,
    workspace_id    UUID NOT NULL,
    contact_id      BIGINT REFERENCES contacts(id) ON DELETE CASCADE,
    company_id      BIGINT REFERENCES companies(id) ON DELETE SET NULL,

    title           TEXT NOT NULL,
    description     TEXT,

    value           NUMERIC(12, 2),
    currency        TEXT NOT NULL DEFAULT 'USD',
    stage           TEXT NOT NULL DEFAULT 'discovery'
        CHECK (stage IN (
            'discovery', 'qualification', 'proposal',
            'negotiation', 'closed_won', 'closed_lost'
        )),
    probability     INTEGER CHECK (probability IS NULL OR (probability >= 0 AND probability <= 100)),
    expected_close  TIMESTAMPTZ,

    -- Provenance
    source          TEXT,
    source_url      TEXT,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_deals_workspace ON deals (workspace_id);
CREATE INDEX IF NOT EXISTS idx_deals_contact ON deals (contact_id);
CREATE INDEX IF NOT EXISTS idx_deals_company ON deals (company_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals (stage);
CREATE INDEX IF NOT EXISTS idx_deals_active ON deals (workspace_id)
    WHERE deleted_at IS NULL;

COMMENT ON TABLE deals IS 'Sales pipeline opportunities. A contact may have many deals.';
COMMENT ON COLUMN deals.source_url IS 'Safe Harbor #14 — may contain personal URLs';

-- ──────────────────────────────────────────────
-- 5. Annotations (polymorphic research surface — Exa, LLM, manual, etc.)
-- ──────────────────────────────────────────────
-- target_type / target_id form a polymorphic reference into one of:
-- contacts, companies, deals, or domain_events. target_id is intentionally NOT
-- a foreign key because one column cannot reference multiple tables. Application
-- code is responsible for verifying the target exists.
--
-- PII: when target_type = 'contact', the value JSONB may transitively carry PII
-- (Exa/LinkedIn/Clearbit results, manual notes). Read paths MUST mask the value
-- by default and only reveal it with an explicit --reveal. See pii.py and crm.py.
CREATE TABLE IF NOT EXISTS annotations (
    id              BIGSERIAL PRIMARY KEY,
    workspace_id    UUID NOT NULL,

    target_type     TEXT NOT NULL
        CHECK (target_type IN ('contact', 'company', 'deal', 'domain_event')),
    target_id       BIGINT NOT NULL,

    source          TEXT,  -- e.g. 'exa', 'llm', 'manual', 'linkedin', 'clearbit'
    key             TEXT NOT NULL,
    value           JSONB,
    confidence      REAL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
    author_id       BIGINT REFERENCES contacts(id) ON DELETE SET NULL,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_annotations_workspace ON annotations (workspace_id);
CREATE INDEX IF NOT EXISTS idx_annotations_target
    ON annotations (workspace_id, target_type, target_id)
    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_annotations_key ON annotations (target_type, key);

COMMENT ON TABLE annotations IS 'Polymorphic research surface. Mask value JSONB when target_type = contact.';
