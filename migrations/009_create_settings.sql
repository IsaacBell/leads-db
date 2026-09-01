-- Pipeline settings — tunable parameters for enrichment, scoring, outreach.
-- Admin panel writes here; processors read at the start of each cycle.
-- Values have sensible code defaults (see processors), this table overrides.

CREATE TABLE IF NOT EXISTS settings (
    id              BIGSERIAL PRIMARY KEY,
    key             TEXT NOT NULL UNIQUE,
    int_value       BIGINT,
    text_value      TEXT,
    float_value     DOUBLE PRECISION,
    bool_value      BOOLEAN,
    label           TEXT,
    description     TEXT,
    category        TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settings_category ON settings (category);

COMMENT ON TABLE settings IS 'Pipeline settings — tuned via admin panel, read by processors at cycle start.';

-- Seed defaults (idempotent via ON CONFLICT DO NOTHING)
INSERT INTO settings (key, int_value, label, description, category)
VALUES
    ('scorer_concurrency', 5,        'Scorer concurrency',  'Parallel LLM scoring requests',               'scorer'),
    ('scorer_timeout', 30,           'Scorer timeout',      'LLM request timeout (seconds)',                'scorer'),
    ('scorer_threshold', 0.5,        'Scorer threshold',    'Minimum LLM score (0-1) to consider a business','scorer'),
    ('scorer_max_scored', 0,         'Scorer max scored',   '0 = unlimited. Caps total scored domains',     'scorer'),
    ('enricher_batch_size', 50,      'Enricher batch size', 'Domains per enrichment cycle',                 'enricher'),
    ('enricher_concurrency', 10,     'Enricher concurrency','Parallel DNS/HTTP fetches',                    'enricher'),
    ('enricher_http_timeout', 10,    'Enricher HTTP timeout','HTTP fetch timeout (seconds)',                'enricher'),
    ('enricher_dns_timeout', 5,      'Enricher DNS timeout', 'DNS timeout (seconds)',                       'enricher'),
    ('promote_interval', 120,        'Promote interval',    'Lead promoter poll interval (seconds)',        'promoter'),
    ('promote_batch', 25,            'Promote batch',       'Domains to promote per cycle',                 'promoter'),
    ('outreach_interval', 300,       'Outreach interval',   'Outreach poll interval (seconds)',             'outreach')
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, text_value, label, description, category)
VALUES
    ('scorer_model', 'llama3.2',     'Scorer model',        'Ollama or OpenAI-compatible model name',       'scorer'),
    ('scorer_api_url', 'http://localhost:11434/api/generate', 'Scorer API URL', 'Ollama/OpenAI endpoint', 'scorer'),
    ('scorer_openai_mode', 'false',  'Scorer OpenAI mode',  'true = use OpenAI-compatible API',             'scorer')
ON CONFLICT (key) DO NOTHING;
