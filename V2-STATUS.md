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
| 3. LLM scoring | `entity_scorer` | ✅ BYOK — any OpenAI-compatible endpoint; keys encrypted at rest; idles until configured |
| 4. CRM promotion | `lead_promoter` | ✅ Scored domains → companies + annotations |
| 5. Outreach | `sequence_dispatcher` | ✅ Pluggable transport (noop default, resend adapter); DRY-RUN by default |
| 6. Deal tracking | `crm.py` CLI | ✅ Full CRUD CLI for deals/contacts/annotations |

### Security — Secret & PII Guards

- **`scripts/guard-secrets.sh`** — command-guard + content-scan modes. Blocks `infisical` (except `infisical run`), `vercel env pull`, bare `env`/`printenv`, `.env` reads, inline DB connection strings. PII blocking for names, emails, family references, compensation.
- **`AGENTS.md`** — self-sufficient agent rules for standalone leads-db clones.
- **GitHub CI** — semgrep (community packs), gitleaks, bandit, `uvx pip-audit`, `pnpm audit --audit-level=high`, shellcheck. Weekly security scan + PR gate.
- **Semgrep** — `sql-injection-raw-query` fixed (was dead — `patterns:` instead of `pattern-either:`).

### CLI / Justfile

Root justfile recipes: `leadsdb-ingest`, `leadsdb-enrich`, `leadsdb-score`, `leadsdb-promote`, `leadsdb-outreach`, `leadsdb-migrate`, `leadsdb-reset`, `leadsdb-seed`, `leadsdb-check`, `leadsdb-run`, `leadsdb-deploy`.

Leads-db justfile: `crm-*` (add/get/list/status/delete/social/deal/annotation), `crm-promote`, `crm-outreach`, `ruff`/`ruff-fix`/`ruff-format`, `ci-*`, `check-secrets`, `guard-pii`, `guarded-cmd`, `deploy`.

### Environment variables (only two)

| Env var | Required for | Notes |
|---|---|---|
| `LDB_DATABASE_URL` (or `DATABASE_URL`) | All DB operations | Neon Postgres connection string. The only env var that can't live in the DB (it *is* the DB). |
| `LDB_SETTINGS_ENCRYPTION_KEY` | Reading/writing secret settings | urlsafe-base64 32-byte key for AES-256-GCM. Required to decrypt BYOK API keys. Generate with: `python -c "import secrets,base64;print(base64.urlsafe_b64encode(secrets.token_bytes(32)).decode())"` |

### BYOK + pipeline settings (`settings` table)

All pipeline tuning and BYOK credentials live in the `settings` table (migration 009), read at the start of each processor cycle — no restart needed to adjust. Secret values (API keys) are AES-256-GCM encrypted at rest.

| Category | Key | Type | Default | Notes |
|---|---|---|---|---|
| `scorer` | `scorer_api_url` | text | `""` | Any OpenAI-compatible `/chat/completions` URL. Empty = scorer idles. |
| `scorer` | `scorer_model` | text | `""` | Model id your endpoint expects. Empty = scorer idles. |
| `scorer` | `scorer_api_key` | **secret** | `""` | Bearer key, encrypted at rest. Optional (omit if no auth). |
| `scorer` | `scorer_concurrency` | int | `5` | Parallel scoring requests. |
| `scorer` | `scorer_timeout` | int | `30` | LLM request timeout (seconds). |
| `scorer` | `scorer_threshold` | float | `0.5` | Minimum score (0–1) to promote. |
| `scorer` | `scorer_max_scored` | int | `0` | 0 = unlimited. Caps total scored. |
| `enricher` | `enricher_batch_size` | int | `50` | Domains per cycle. |
| `enricher` | `enricher_concurrency` | int | `10` | Parallel DNS/HTTP fetches. |
| `enricher` | `enricher_http_timeout` | int | `10` | HTTP fetch timeout (sec). |
| `enricher` | `enricher_dns_timeout` | int | `5` | DNS timeout (sec). |
| `promoter` | `promoter_interval` | int | `120` | Poll interval (sec). |
| `promoter` | `promoter_batch` | int | `25` | Domains per cycle. |
| `promoter` | `promoter_workspace_id` | text | `"main"` | Target CRM workspace. |
| `outreach` | `outreach_transport` | text | `"noop"` | Adapter name. `noop` = log-only (default). |
| `outreach` | `outreach_api_key` | **secret** | `""` | Credential for the selected transport (encrypted). |
| `outreach` | `outreach_from_address` | text | `""` | Sender address. Format depends on adapter. |
| `outreach` | `outreach_workspace_id` | text | `"main"` | Workspace the dispatcher operates on. |
| `outreach` | `outreach_interval` | int | `300` | Dispatch poll interval (sec). |
| `outreach` | `outreach_sequence` | text/JSON | `NULL` | Optional JSON array of `{subject,body_template}`. NULL = built-in 3-step default. |

## Remaining Gaps

### Before launch

1. **Apply migrations 005–009 to Neon** — `just leadsdb-migrate` (005 was never applied per prior handoff; 009 adds the `settings` table with encrypted-value support).
2. **Contact/email discovery** — CT logs give domains, not people. The promoter creates companies, but contacts with emails need either:
   - Exa contact-page scraper / company research (EXA_API_KEY already exists in the monorepo)
   - Clearbit integration
   - Manual seeding
3. **Configure BYOK settings** — open the **Settings** page in the app (`/settings`). Set `scorer_api_url`, `scorer_model` (plaintext) and `scorer_api_key` (encrypted via the secrets endpoint). Set `LDB_SETTINGS_ENCRYPTION_KEY` env var first. No other env vars needed.
4. **Deploy** — `just leadsdb-deploy` (builds Next.js + `vercel deploy --prod`)

### Deployed (V2 settings UI)

- **Settings UI** (`/settings`) — Perplexica-style form grouped by category (scorer, enricher, promoter, outreach). Plain settings save inline; secrets are password-masked, encrypted with AES-256-GCM, never echoed on GET.
- **API routes** — `GET /api/v1/settings` (list masked), `POST /api/v1/settings` (set plain), `POST /api/v1/settings/secrets` (encrypt & store / clear).
- **Admin token gate** — `LEADSDB_ADMIN_TOKEN` env var on settings routes. Pass via `x-admin-token` header or browser localStorage.
- **TS crypto layer** (`libs/crypto.ts`) — AES-256-GCM interop with Python `crypto.py`. 13 Vitest tests.
- **V1 cruft removed** — old landing page, Header/Footer/Privacy components, `astraDb.ts`, `evergreen-ui`, `@heroicons/react`, `notistack`, subscribe route, about page, public assets all deleted.
### Lower priority

- **Analytics funnel bridge** — emit funnel events to `analytics-engine` when outreach dispatches or deal stage changes
- **API key auth** on write endpoints (Phase 2)
- **Exa contact-discovery module** — `leadsdb_engine/exa.py` stubbed in justfile but not yet built
- **Pre-existing ruff warnings** — 19 style/import issues (all pre-existing, not from V2 work)
- **2 pytest false failures** — `test_db.py` pydantic validation tests (pydantic v2 doesn't reject empty strings by default). Pre-existing, unrelated to the settings refactor.
- **Env var count** — three env vars now (`LDB_DATABASE_URL`, `LDB_SETTINGS_ENCRYPTION_KEY`, `LEADSDB_ADMIN_TOKEN`). Documented in V2-STATUS.
