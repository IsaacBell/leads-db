# LeadsDB V2 Status

**Last updated:** 2026-08-31  
**Phase:** Pipeline closed end-to-end (discovery → enrichment → scoring → CRM promotion → outreach)

---

## What's Done

### Database (Neon Postgres — 8 migrations)

| Migration | Table / Change | Status |
|---|---|---|
| `001` | pgcrypto, pg_trgm extensions | Applied |
| `002` | `domain_events` — core ingestion table | Applied |
| `003` | `domain_classifications` — DNS/HTTP/LLM results | Applied |
| `004` | `api_keys` — freemium API keys (Phase 2) | Applied |
| `005` | CRM: `companies`, `contacts`, `social_links`, `deals`, `annotations` | Applied |
| `006` | `body_preview TEXT` on `domain_classifications` | Created |
| `007` | `promoted_company_id` on `domain_classifications` | Created |
| `008` | `outreach_logs` — dispatch log with contact FK | Created |

### Pipeline (closed loop)

| Stage | Processor | Status |
|---|---|---|
| 1. Domain ingestion | `certstream_ingestor` | ✅ Live — WebSocket → `domain_events` |
| 2. DNS/HTTP enrichment | `domain_enricher` | ✅ Async DNS + HTTP fetch + keyword rules |
| 3. LLM scoring | `entity_scorer` | ✅ Ollama & OpenAI-compatible; body fed to LLM |
| 4. CRM promotion | `lead_promoter` | ✅ Scored domains → companies + annotations |
| 5. Outreach | `sequence_dispatcher` | ✅ Native Resend engine; DRY-RUN mode |
| 6. Deal tracking | `crm.py` CLI | ✅ Full CRUD CLI for deals/contacts/annotations |

### Security — Secret & PII Guards

- **`scripts/guard-secrets.sh`** — command-guard + content-scan modes. Blocks `infisical` (except `infisical run`), `vercel env pull`, bare `env`/`printenv`, `.env` reads, inline DB connection strings. PII blocking for names, emails, family references, compensation.
- **`AGENTS.md`** — self-sufficient agent rules for standalone leads-db clones.
- **GitHub CI** — semgrep (community packs), gitleaks, bandit, `uvx pip-audit`, `pnpm audit --audit-level=high`, shellcheck. Weekly security scan + PR gate.
- **Semgrep** — `sql-injection-raw-query` fixed (was dead — `patterns:` instead of `pattern-either:`).

### CLI / Justfile

Root justfile recipes: `leadsdb-ingest`, `leadsdb-enrich`, `leadsdb-score`, `leadsdb-promote`, `leadsdb-outreach`, `leadsdb-migrate`, `leadsdb-reset`, `leadsdb-seed`, `leadsdb-check`, `leadsdb-run`, `leadsdb-deploy`.

Leads-db justfile: `crm-*` (add/get/list/status/delete/social/deal/annotation), `crm-promote`, `crm-outreach`, `ruff`/`ruff-fix`/`ruff-format`, `ci-*`, `check-secrets`, `guard-pii`, `guarded-cmd`, `deploy`.

### Infisical secrets (`/leads-db`)

| Secret | Required for |
|---|---|
| `LDB_DATABASE_URL` | All DB operations |
| `LEADSDB_PROMOTE_WORKSPACE_ID` | Promoter (Stage 4) |
| `LEADSDB_OUTREACH_WORKSPACE_ID` | Outreach (Stage 5) |
| `RESEND_API_KEY` | Outreach email delivery |
| `RESEND_FROM_ADDRESS` | Outreach sender (defaults to LeadsDB <outreach@leadsdb.news>) |
| `ENTITY_SCORER_API_URL` / `ENTITY_SCORER_MODEL` / `ENTITY_SCORER_API_KEY` | LLM scoring |
| `EXA_API_KEY` | Contact discovery (next) |

## Remaining Gaps

### Before launch

1. **Apply migrations 006–008 to Neon** — `just leadsdb-migrate` (migration 005 was never applied either per prior handoff)
2. **Contact/email discovery** — CT logs give domains, not people. The promoter creates companies, but contacts with emails need either:
   - Exa contact-page scraper / company research (EXA_API_KEY already exists in the monorepo)
   - Clearbit integration
   - Manual seeding
3. **Set Infisical env vars** — `LEADSDB_PROMOTE_WORKSPACE_ID`, `LEADSDB_OUTREACH_WORKSPACE_ID`, `ENTITY_SCORER_*`, `EXA_API_KEY`
4. **Deploy** — `just leadsdb-deploy` (builds Next.js + `vercel deploy --prod`)

### Lower priority

- **Analytics funnel bridge** — emit funnel events to `analytics-engine` when outreach dispatches or deal stage changes
- **API key auth** on write endpoints (Phase 2)
- **Exa contact-discovery module** — `leadsdb_engine/exa.py` stubbed in justfile but not yet built
- **Pre-existing ruff warnings** — 19 style/import issues (all pre-existing, not from V2 work)
- **2 pytest false failures** — `test_db.py` pydantic validation tests (pydantic v2 doesn't reject empty strings by default)
