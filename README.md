<div align="center">

# LeadsDB

**Open-source B2B lead pipeline — CT-log discovery → enrichment → LLM scoring → CRM → outreach**

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)
![React](https://img.shields.io/badge/React-19-blue.svg)
![Python](https://img.shields.io/badge/python-3.12+-yellow.svg)
![Postgres](https://img.shields.io/badge/DB-Postgres-green.svg)

</div>

LeadsDB turns certificate-transparency logs into a working B2B lead pipeline:

1. **Ingest** raw domains from the certstream WebSocket
2. **Enrich** domains with DNS/HTTP + rule-based classification
3. **Score** promising domains with any LLM (BYOK)
4. **Promote** scored domains into a multi-tenant CRM
5. **Outreach** via pluggable email transports (log-only by default)

The web UI (Next.js) and the Python engine share one Postgres database.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend / API | Next.js 16 (App Router), React 19, TypeScript, Tailwind, pnpm |
| Engine | Python 3.12, asyncio, httpx, psycopg3, uv |
| Database | Postgres (Neon serverless supported) |
| Data source | Certificate Transparency logs via certstream |
| LLM scoring | Any OpenAI-compatible endpoint (BYOK) |
| Email | Resend (magic-link auth + outreach transport adapter) |
| Auth | Better Auth (self-hosted, magic link) |
| Secrets | Infisical (maintainers) / `.env` (self-hosters) |

---

## Quick start

### Prerequisites

Install [mise](https://mise.jdx.dev), then run from the repo root to install the pinned toolchain (Node, pnpm, Python, uv, just, vercel):

```shell
mise install
mise exec -- pnpm install
```

Alternative: install tools manually. Minimums: Node 20.19+, pnpm 9+, Python 3.12+, [uv](https://docs.astral.sh/uv), [just](https://github.com/casey/just).

### Configure secrets

Copy the template and fill blanks (never commit `.env`):

```shell
cp .env.example .env
```

You need at minimum `LDB_DATABASE_URL` (see below). Maintainers inject the full secret set from Infisical path `/leads-db` instead.

### Set up the database

Postgres is required. Use a free hosted provider like [Neon](https://neon.tech), or run one locally. Set the connection string in `.env`:

```
LDB_DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
```

Apply migrations (SQL lives in `src/migrations`):

```shell
just leadsdb-migrate
# or, without the just/Infisical wrapper:
psql "$LDB_DATABASE_URL" -f src/migrations/001_create_extensions.sql   # ...repeat per file
```

### Run the frontend

```shell
pnpm dev   # http://localhost:3000
```

Sign-in uses magic links. With no `RESEND_API_KEY` set, magic links are logged to the server console (dev only); set `RESEND_API_KEY` to send real emails.

### Run the pipeline (Python engine)

```shell
just leadsdb-run       # all processors in sequence
just leadsdb-enrich    # stage 2
just leadsdb-score     # stage 3 (needs LLM config, below)
just leadsdb-promote   # stage 4
```

---

## Environment variables

See [`.env.example`](.env.example) for the full documented list with blanks. The core ones:

| Variable | Required | Purpose |
|---|---|---|
| `LDB_DATABASE_URL` | Yes | Postgres connection string |
| `BETTER_AUTH_SECRET` | Yes (prod) | Auth session encryption. Generate: `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | Yes | Public base URL (e.g. `http://localhost:3000`) |
| `RESEND_API_KEY` | Auth needs email | Sends magic links (unset = log to console, dev only) |
| `LEADSDB_ADMIN_TOKEN` | Settings API | Gates the `/api/v1/settings` admin routes |

---

## BYOK & security model

LeadsDB is **bring-your-own-key**. No AI provider is baked in. Your LLM endpoint, model, and API key are your choice.

| What | Where | Encrypted? |
|---|---|---|
| LLM endpoint URL (`scorer_api_url`) | `settings` table | No — it's a URL |
| LLM model name (`scorer_model`) | `settings` table | No — it's a model id |
| LLM API key (`scorer_api_key`) | `settings` table | **Yes** — AES-256-GCM at rest |
| Outreach transport key (`outreach_api_key`) | `settings` table | **Yes** — AES-256-GCM at rest |
| Master encryption key | Env / Infisical | N/A — the key itself |

Configure the scorer through the settings CLI or DB:

```sql
UPDATE settings SET text_value = 'https://api.openai.com/v1/chat/completions' WHERE key = 'scorer_api_url';
UPDATE settings SET text_value = 'gpt-4o-mini' WHERE key = 'scorer_model';
```

Until `scorer_api_url` and `scorer_model` are set, the scorer logs once and idles.

---

## Outreach transports

Outreach is vendor-agnostic. The `outreach_transport` setting selects the adapter:

| Transport | What it does | Status |
|---|---|---|
| `noop` | Logs what it would send — no real email. **Default.** | ✅ Built-in |
| `resend` | Live sends via the Resend HTTP API | ✅ Reference adapter |

Add a provider by implementing `EmailTransport` in `engine/leadsdb_engine/transports/`, registering it, and setting `outreach_transport`. A fresh deploy cannot send cold email — default is log-only.

---

## Repo layout

```
leads-db/
├── src/
│   ├── app/            # Next.js pages + API routes
│   │   └── api/        #   v1, v2 route handlers
│   ├── lib/            # frontend libs (api client, auth)
│   ├── migrations/     # SQL migrations (001–009)
│   └── wip/            # operator-shell pages (old repo, being wired in)
├── engine/
│   └── leadsdb_engine/
│       ├── processors/ # certstream, enricher, scorer, promoter, dispatcher
│       ├── transports/ # email transport adapters (noop, resend)
│       ├── crypto.py   # AES-GCM settings encryption
│       ├── db.py       # Postgres layer + settings read/write
│       ├── crm.py      # CLI for contacts/deals/annotations
│       └── pii.py      # Safe Harbor masking
├── scripts/            # Guardrails, CI helpers, migrations
├── .mise.toml          # pinned toolchain (Node/Python/uv/just/vercel)
├── .env.example        # documented env template (fork-safe)
└── justfile            # task runner (CRM, pipeline, CI, deploy)
```

---

## CRM

Built-in multi-tenant CRM with Safe Harbor PII masking. Contacts, companies, deals, annotations, social links — all with soft deletes and workspace isolation.

```shell
just crm-add "jane@example.com" --name "Jane Doe"     # add a lead (PII masked on read)
just crm-list                                          # list (masked by default)
just crm-list --reveal                                 # full PII (use with care)
just crm-deal-add "Q3 retainer" --value 12000         # create a deal
just crm-annotation-add contact 42 linkedin '{"headline":"CTO"}'  # enrich
```

---

## DevSecOps & tooling

Every push runs a security and quality gate (lint, typecheck, tests, SAST, IOC scan, whitespace guard).

| Tool | Role |
|---|---|
| [mise](.mise.toml) | Pinned runtimes/tools for reproducible builds |
| [Infisical](https://infisical.com) | Maintainer secret store (path `/leads-db`) |
| [fnox](fnox.toml.example) | Optional passkey-gated access to Infisical |
| guard scripts | PII/secret/whitespace enforcement in CI |

```shell
just install-hooks    # install git hooks
just ci-check         # run the local gate before pushing
```

Self-hosters skip Infisical/fnox entirely and use `.env`.

---

## Contributing

Trunk-based branching. Every push must pass the CI gate.

## License

[MIT](LICENSE) — publicly MIT-licensed since 2024.
