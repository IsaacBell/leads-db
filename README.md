<div align="center">

# LeadsDB

**Open-source B2B lead pipeline — CT-log discovery → enrichment → LLM scoring → CRM → outreach**

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![CI](https://github.com/IsaacBell/leads-db/actions/workflows/ci.yml/badge.svg)
![Python](https://img.shields.io/badge/python-3.12+-yellow.svg)
![Next.js](https://img.shields.io/badge/Next.js-13-black.svg)
![Neon](https://img.shields.io/badge/DB-Neon_Postgres-green.svg)

</div>

---


---

## Quick start

### Prerequisites

You will need just. Install it with one of the following:

```shell
% brew install just
% apt install just
```

| Dependency | Version |
|---|---|
| Node.js | 18+ |
| Python | 3.12+ |
| [uv](https://docs.astral.sh/uv/) | latest |
| [pnpm](https://pnpm.io) | 9+ |
| [just](https://github.com/casey/just) | latest |

### Clone & install

```bash
git clone https://github.com/IsaacBell/leads-db.git
cd leads-db

# Frontend
pnpm install

# Engine (Python)
# [@todo - install setup should be in justfile]
cd engine && uv sync --extra dev && cd ..
```

### Set up the database

Set up Postgres. You can use a free provider like Neon, or create your own manually. 

Either way, when your database is created, save your connection string.

Example:
`postgresql://user:pass@host/db?sslmode=require`

@todo - where the hell to save the connection string? In-app setting + env var fallback else prompt user to enter during install/setup.
---
Apply migrations:

```bash
just leadsdb-migrate
```

### Generate the settings encryption key

@todo - this is awful awful awful. users just enter their key in a form and we do standard encryption on it. this is terrible

BYOK API keys are stored **encrypted at rest** in the `settings` table. Generate a master key:

```bash
python -c "import secrets,base64; print(base64.urlsafe_b64encode(secrets.token_bytes(32)).decode())"
```

@todo - making users set encrypted env vars?????????????

Set it as an environment variable (the only secret that lives outside the DB):

```bash
export LDB_SETTINGS_ENCRYPTION_KEY="your-generated-key-here"
```




@todo - THIS SUCKS

### Configure your LLM (BYOK)

Point the scorer at any OpenAI-compatible endpoint — OpenAI, DeepInfra, Vercel AI Gateway, vLLM, llama.cpp, Ollama's OpenAI-compat mode, etc. Use the settings CLI (or your DB client) to set:

```sql
-- Your endpoint and model (plaintext settings)
UPDATE settings SET text_value = 'https://api.openai.com/v1/chat/completions' WHERE key = 'scorer_api_url';
UPDATE settings SET text_value = 'gpt-4o-mini'                                    WHERE key = 'scorer_model';

-- Your API key (encrypted at rest — use the settings CLI, not raw SQL)
-- just settings-set-secret scorer_api_key "sk-..."
```

Until `scorer_api_url` and `scorer_model` are set, the scorer logs once and idles — it never guesses a default host.

### Run the pipeline

```bash
just leadsdb-run   # starts all processors in sequence (Redis-style background loop)
# or run individually:
just leadsdb-enrich   # enrichment processor
just leadsdb-score    # entity scorer (needs BYOK config above)
just leadsdb-promote  # promoter (scored domains → CRM)
```

### Run the frontend

```bash
pnpm dev   # Next.js dev server on localhost:3000
```

---

@Todo - DO YOU NOT KNOW WHAT FUCKING BYOK MEANS???????? WHAT IS THIS SHITTY TABLE

## BYOK & security model

LeadsDB is **bring-your-own-key**. No AI provider is baked in. Your LLM endpoint, model, and API key are your choice.

| What | Where | Encrypted? |
|---|---|---|
| LLM endpoint URL (`scorer_api_url`) | `settings` table | No — it's a URL |
| LLM model name (`scorer_model`) | `settings` table | No — it's a model id |
| LLM API key (`scorer_api_key`) | `settings` table | **Yes** — AES-256-GCM at rest |
| Outreach transport key (`outreach_api_key`) | `settings` table | **Yes** — AES-256-GCM at rest |
| Master encryption key (`LDB_SETTINGS_ENCRYPTION_KEY`) | Env var / Infisical | N/A — the key itself |
| Database URL (`LDB_DATABASE_URL`) | Env var / Infisical | N/A — connection string |

The only two environment variables are the database connection string and the settings encryption key. Everything else — endpoint URLs, model names, tuning knobs, workspace selectors, API keys — lives in the `settings` table and can be changed at runtime without a restart.

---

## Outreach transports

Outreach is vendor-agnostic. The `outreach_transport` setting selects the adapter:

| Transport | What it does | Status |
|---|---|---|
| `noop` | Logs what it would send — no real email. **Default.** | ✅ Built-in |
| `resend` | Live sends via the Resend HTTP API (for maintainer testing) | ✅ Reference adapter |

To add a provider: create `transports/<name>.py` implementing `EmailTransport`, register it in `transports/__init__.py`, and set `outreach_transport`. A fresh deploy cannot send cold email to anyone — the default is always log-only.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 13, React 18, TypeScript, Tailwind |
| API | Next.js API routes (replaces V1 Flask) |
| Engine | Python 3.12+, asyncio, httpx, psycopg3 |
| Database | Neon Postgres (serverless, scale-to-zero) |
| Data source | Certificate Transparency logs via certstream |
| LLM scoring | Any OpenAI-compatible endpoint (BYOK) |
| Email outreach | Pluggable transport adapter (noop / resend / extensible) |
| Secrets | AES-256-GCM encryption at rest, Infisical for the master key |

---

## CRM

Built-in multi-tenant CRM with Safe Harbor PII masking. Contacts, companies, deals, annotations, social links — all with soft deletes and workspace isolation.

```bash
just crm-add "jane@example.com" --name "Jane Doe"     # add a lead (PII masked on read)
just crm-list                                          # list (masked by default)
just crm-list --reveal                                 # full PII (use with care)
just crm-deal-add "Q3 retainer" --value 12000         # create a deal
just crm-annotation-add contact 42 linkedin '{"headline":"CTO"}'  # enrich
```

---

## Architecture

See [`V2-PLAN.md`](V2-PLAN.md) for the full design doc and [`V2-STATUS.md`](V2-STATUS.md) for current state.

```
leads-db/
├── app/                    # Next.js frontend + API routes
├── engine/                 # Python pipeline
│   └── leadsdb_engine/
│       ├── processors/     # certstream, enricher, scorer, promoter, dispatcher
│       ├── transports/     # email transport adapters (noop, resend)
│       ├── crypto.py       # AES-GCM settings encryption
│       ├── db.py           # Neon Postgres layer + settings read/write
│       ├── crm.py          # CLI for contacts/deals/annotations
│       ├── pii.py          # Safe Harbor HIPAA-18 masking
│       └── domain_utils.py
├── migrations/            # SQL migrations (001–009)
├── scripts/               # Guardrails, CI helpers
├── justfile               # Task runner (CRM, pipeline, CI, deploy)
└── .github/               # CI, security scans, dependabot
```

---

## DevSecOps

Every PR runs a multi-layer security and quality gate:

| Check | Tool | When |
|---|---|---|
| Lint + typecheck | Next.js / TypeScript | Push + PR |
| Python lint | Ruff + Bandit | Push + PR |
| JS tests | Vitest | Push + PR |
| Python tests | pytest | Push + PR |
| SAST | Semgrep (13 custom rules) | Push + PR |
| Shell lint | ShellCheck | Push + PR |
| Dependency audit | npm audit + uv audit + pip-audit | Weekly |
| Deep security scan | Semgrep + Bandit | Weekly (Mon 06:00 UTC) |
| Dep updates | Dependabot (grouped) | Weekly PRs |

```bash
just ci-check    # run everything CI runs
just ruff         # python lint only
just ci-bandit    # python SAST only
```

---

## Roadmap

- [x] CT-log ingestion → domain events
- [x] DNS/HTTP enrichment + rule-based classification
- [x] LLM entity scoring (BYOK, any OpenAI-compatible endpoint)
- [x] CRM schema (contacts, companies, deals, annotations, social links)
- [x] Lead promotion pipeline
- [x] Outreach dispatch (pluggable transport, noop default)
- [x] DevSecOps foundation (CI, SAST, secrets guard)
- [ ] docker-compose for one-command local stack (Phase 1 goal)
- [ ] Contact/email discovery (CT logs give domains, not people)
- [ ] Freemium API keys + rate limiting (Phase 2)
- [ ] Analytics funnel bridge to `analytics-engine`

Full phase breakdown in [`V2-PLAN.md`](V2-PLAN.md).

---

## Contributing

This project follows a trunk-based branching strategy. See the DevSecOps section above for the CI gate — every push must pass lint, tests, and SAST.

```bash
# Install hooks
just install-hooks

# Run the full local gate before pushing
just ci-check
```

## License

[MIT](LICENSE) — LeadsDB has been publicly MIT-licensed since 2024.
