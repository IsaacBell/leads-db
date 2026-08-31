# LeadsDB V2 Status

**Last updated:** 2026-08-31  
**Phase:** Engine restructured around enrichment pipeline processors, guard-secrets hardened

---

## What's Done

### Infrastructure

- **Neon Postgres** provisioned via Vercel marketplace (`neon-rose-elephant`), linked to `leads-db` Vercel project
- **Env vars** stored in Infisical under `/leads-db` with `LDB_` prefix (17 vars, dev + prod)
- **Transfer script** `scripts/vercel-neon-to-infisical.sh` for credential rotation
- **Just recipes**: `leadsdb-vercel-to-infisical`, `leadsdb-migrate`, `leadsdb-reset`, `leadsdb-check`, `leadsdb-ingest`, `leadsdb-enrich`, `leadsdb-score`, `leadsdb-install`, `leadsdb-run`, `leadsdb-seed`

### Database (Neon Postgres — 4 migrations)

1. `001_create_extensions.sql` — pgcrypto, pg_trgm
2. `002_create_domain_events.sql` — core ingestion table (cert_fingerprint + registrable_domain unique)
3. `003_create_domain_classifications.sql` — DNS/HTTP/LLM classification results
4. `004_create_api_keys.sql` — freemium API keys (Phase 2)

### Python Engine (`engine/`)

**Shared layer:**
- **`leadsdb_engine/db.py`** — Pure-Python Postgres layer via psycopg. SQL constants co-located with model definitions. No ORM.
- **`leadsdb_engine/domain_utils.py`** — `normalize_domain()` shared across all processors.
- **`leadsdb_engine/processors/base.py`** — `EnrichmentProcessor` base class with DB connectivity check, signal handling, and logging setup.

**Pipeline processors:**
- **`processors/certstream_ingestor.py`** — `CertstreamIngestor`: WebSocket (`wss://certstream.calidog.dev/`), extracts SANs, normalizes to registrable domains, inserts into `domain_events`. Auto-reconnect, stats logging.
- **`processors/domain_enricher.py`** — `DomainEnricher`: async DNS resolution + HTTP fetch + rule-based classification (business keywords, parked indicators). Flags promising domains as LLM candidates.
- **`processors/entity_scorer.py`** — `EntityScorer`: LLM scoring for promising domains. Supports Ollama (local) and OpenAI-compatible APIs. Score 0-1 with reasoning and category.

Old names deleted: `consumer.py`, `classify.py`, `llm_gate.py`.

### Seed Data

- **`engine/scripts/seed.py`** — 7 sample domains (4 real businesses, 2 parked, 1 non-resolving). Run via `just leadsdb-seed`. Seed data already applied to Neon.

### Next.js API Route

- **`GET /api/v1/leads`** at `app/api/v1/leads/route.ts`. Returns JSON `{ leads: [...] }` from `domain_events` JOIN `domain_classifications` WHERE `has_business_content=true AND is_parked=false`. Ordered by `llm_score DESC`, limited to 50.
- Uses `pg` (Node.js TCP driver — no macOS security warnings).

### Flask Removed

- Deleted `api/` dir (Flask backend with Astra DB, Kafka, Abstract API, Moesif, Firebase, Notion).
- Deleted `Dockerfile`, `requirements.txt`.
- Rewrites stripped from `next.config.js`.
- V1 dependencies removed from `package.json`.

### Security — Secret & PII Guards

- **`scripts/guard-secrets.sh`** and **`.rulesync/hooks/guard-secrets.sh`** — rewritten with catch-all: ANY `infisical` command that isn't `infisical run` is blocked. No per-subcommand enumeration that can be gamed by flags. Also blocks: `vercel env pull`, `.env` reads, bare `env`/`printenv`, `pg_dump`/`pg_restore`/`psql` with inline connection strings, Python scripts reading credential files. PII blocking for names, emails, family references, internal roles, compensation.
- **Exception**: `scripts/vercel-neon-to-infisical.sh` (pipes all output to `/dev/null`).
- **Just recipes**: `check-secrets`, `guard-pii`, `guarded-cmd`.

## What's Decided

| Decision | Value |
|---|---|
| Data source | certstream (free WebSocket, aggregates CT logs) |
| Database | Neon Postgres (via Vercel, Infisical for secrets) |
| Stack | Python (consumer/classifier/gate) + TypeScript (API/frontend) |
| Frontend | Keep existing Next.js |
| Backend | Next.js API routes (Flask replaced) |
| No Docker | Native processes via justfile |
| License | MIT |
| Repo | Same repo, main branch |

## Next Up

1. **Run consumer live** — `just leadsdb-consumer`
2. **Run classifier** — `just leadsdb-classify` against live data
3. **Phase 2**: API keys, usage limits, `POST /api/v1/subscribe`
4. **Deployment**: Next.js to Vercel, Python engine to VPS (provider TBD)
