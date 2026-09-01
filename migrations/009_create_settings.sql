-- Pipeline settings — tunable parameters and BYOK secrets.
--
-- Two kinds of rows live here:
--   * plain settings  — endpoint URL, model name, tuning knobs, workspace
--                       selectors. Stored in the typed column that fits
--                       (int_value / text_value / float_value / bool_value).
--   * secret settings — user-supplied API keys (BYOK). NEVER stored as plain
--                       text. is_secret = true and the AES-GCM ciphertext
--                       lives in encrypted_value; the plain text columns stay
--                       NULL. Decrypted on read by leadsdb_engine.crypto using
--                       the LDB_SETTINGS_ENCRYPTION_KEY master key.
--
-- Admin panel (and the crm/settings CLI) write here; processors read at the
-- start of each cycle so changes take effect without a restart. Everything
-- below ships empty/blank by default — BYOK in, scorer idles until a user
-- supplies an endpoint + model (+ optional key). No provider is baked in.

CREATE TABLE IF NOT EXISTS settings (
    id              BIGSERIAL PRIMARY KEY,
    key             TEXT NOT NULL UNIQUE,
    int_value       BIGINT,
    text_value      TEXT,
    float_value     DOUBLE PRECISION,
    bool_value      BOOLEAN,
    encrypted_value BYTEA,              -- AES-GCM ciphertext for is_secret rows
    is_secret       BOOLEAN NOT NULL DEFAULT false,
    label           TEXT,
    description     TEXT,
    category        TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settings_category ON settings (category);

COMMENT ON TABLE settings IS 'Pipeline tuning + BYOK secrets. Secrets AES-GCM encrypted at rest (encrypted_value), decrypted on read via LDB_SETTINGS_ENCRYPTION_KEY.';

-- ----------------------------------------------------------------------
-- Plain-typed tuning + selection defaults. (idempotent seed.)
-- ----------------------------------------------------------------------
INSERT INTO settings (key, int_value, label, description, category)
VALUES
    ('scorer_concurrency',  5,   'Scorer concurrency',  'Parallel LLM scoring requests',                   'scorer'),
    ('scorer_timeout',      30,  'Scorer timeout',      'LLM request timeout (seconds)',                    'scorer'),
    ('scorer_max_scored',   0,   'Scorer max scored',   '0 = unlimited. Caps total scored domains.',        'scorer'),
    ('enricher_batch_size', 50,  'Enricher batch size', 'Domains per enrichment cycle',                     'enricher'),
    ('enricher_concurrency',10,  'Enricher concurrency','Parallel DNS/HTTP fetches',                        'enricher'),
    ('enricher_http_timeout',10, 'Enricher HTTP timeout','HTTP fetch timeout (seconds)',                    'enricher'),
    ('enricher_dns_timeout', 5,  'Enricher DNS timeout', 'DNS timeout (seconds)',                           'enricher'),
    ('promoter_interval',  120, 'Promoter interval',   'Lead promoter poll interval (seconds)',            'promoter'),
    ('promoter_batch',     25,  'Promoter batch',       'Domains to promote per cycle',                     'promoter'),
    ('outreach_interval',  300, 'Outreach interval',   'Outreach dispatch poll interval (seconds)',         'outreach')
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, float_value, label, description, category)
VALUES
    ('scorer_threshold', 0.5, 'Scorer threshold', 'Minimum LLM score (0-1) to consider a business', 'scorer')
('outreach_interval',  300, 'Outreach interval',   'Outreach dispatch poll interval (seconds)',         'outreach')
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, text_value, label, description, category)
VALUES
    ('scorer_api_url', '',        'LLM endpoint (BYOK)', 'Any OpenAI-compatible /chat/completions URL. Empty = scorer idles.', 'scorer'),
    ('scorer_model',   '',        'LLM model name',      'Model id your endpoint expects (e.g. gpt-4o-mini). Empty = scorer idles.', 'scorer'),
    ('promoter_workspace_id', 'main', 'Promoter workspace', 'Workspace the lead promoter writes CRM records to.',  'promoter'),
    ('outreach_workspace_id', 'main', 'Outreach workspace', 'Workspace the outreach dispatcher operates on.',       'outreach'),
    ('outreach_transport','noop', 'Outreach transport',  'Adapter name. "noop" = log-only / DRY-RUN (default until a provider is chosen).', 'outreach'),
    ('outreach_from_address', '', 'Outreach from address','Sender for the chosen transport (address format depends on the adapter).', 'outreach'),
    ('outreach_sequence', NULL, 'Outreach sequence (JSON)', 'Optional JSON array of {subject,body_template}. NULL = built-in 3-step default.', 'outreach')
ON CONFLICT (key) DO NOTHING;

-- ----------------------------------------------------------------------
-- BYOK secret rows: seeded empty (no ciphertext). A user sets the value via
-- the admin panel / settings CLI, which encrypts it into encrypted_value.
-- ----------------------------------------------------------------------
INSERT INTO settings (key, is_secret, encrypted_value, label, description, category)
VALUES
    ('scorer_api_key',    true, NULL, 'LLM API key (BYOK, encrypted)',       'Bearer key for scorer_api_url. Optional (omit if your endpoint needs no auth).', 'scorer'),
    ('outreach_api_key',  true, NULL, 'Outreach transport key (encrypted)', 'Credential for the selected outreach_transport adapter. Absent/blank = adapters that need no auth or DRY-RUN.', 'outreach')
ON CONFLICT (key) DO NOTHING;
