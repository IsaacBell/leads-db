# LeadsDB V2 Plan

**Date:** 2026-08-30  
**Status:** Planning complete, ready to scaffold  
**License:** MIT (ratifying the grant the README has made since 2024)

---

## Accepted Stack

| Component | Technology | Rationale |
|---|---|---|
| Database | Neon Postgres | Free tier, scale-to-zero, serverless. Isaac said "power it with neon." |
| CT log consumer | Rust | 10M+ certs/day, dual API families, long-running process with checkpointing. Performance and reliability matter here. |
| API surface | Next.js API routes (TypeScript) | Reuse existing Next.js server. Replace Flask with route handlers in `app/api/`. Single deploy surface. |
| Frontend | Next.js (existing) | Kept as-is per Isaac's instruction. |
| Container orchestration | docker-compose | Single command to run the full stack. Strangers clone the repo, `docker compose up`, and have a working system. |
| API auth | API key + usage limits | Keys stored in Postgres. Middleware enforces per-key rate limits. |

---

## Project Structure

```
apps/leads-db/
├── api/                          # (V1 backend — to be removed in Phase 2)
├── app/                          # Next.js app router (frontend stays)
│   ├── page.tsx                  # Existing landing page — kept
│   ├── layout.tsx                # Existing layout — kept
│   ├── globals.css               # Existing styles — kept
│   ├── about/                    # Existing — kept
│   ├── subscribe/                # Existing — kept
│   └── api/                      # NEW: V2 API routes
│       ├── v1/
│       │   ├── leads/route.ts    # GET /api/v1/leads
│       │   ├── domains/route.ts  # GET /api/v1/domains
│       │   └── subscribe/route.ts # POST /api/v1/subscribe (replaces Flask endpoint)
│       └── v2/                   # Future API expansion
├── components/                   # (stays, existing React components)
├── ct-consumer/                  # NEW: Rust CT log consumer
│   ├── Cargo.toml
│   ├── src/
│   │   ├── main.rs              # Entrypoint, log list fetch, scheduling
│   │   ├── log_list.rs          # Chrome CT log list fetcher + parser
│   │   ├── consumer_rfc6962.rs  # RFC 6962 / RFC 9162 entry fetcher
│   │   ├── consumer_static.rs   # Static CT API tile downloader
│   │   ├── parser.rs            # Certificate SAN extraction + normalization
│   │   ├── dedup.rs             # Idempotency key deduplication
│   │   ├── models.rs            # Domain event structs
│   │   ├── db.rs                # Neon Postgres client (via sqlx)
│   │   └── metrics.rs           # Processing metrics, lag tracking
│   └── Dockerfile
├── seed/                         # NEW: seed data generation
│   ├── Dockerfile
│   └── src/
│       └── main.rs              # Generates sample domains for demo mode
├── docker-compose.yml            # NEW: the single entry point
├── migrations/                   # NEW: SQL migrations
│   ├── 001_create_ct_logs.sql
│   ├── 002_create_domain_events.sql
│   └── 003_create_api_keys.sql
├── V2-PLAN.md                    # This file
├── V2-STATUS.md                  # Current state tracker
├── package.json                  # (exists, may need updates)
├── next.config.js                # (exists, update rewrites)
├── tsconfig.json                 # (exists)
└── README.md                     # (update for V2)
```

---

## Data Model (Neon Postgres)

### Table: `ct_logs`
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| log_id | TEXT | Chrome's log ID (base64-encoded key hash) |
| url | TEXT | Log endpoint URL |
| api_type | TEXT | `rfc6962` or `static_ct` |
| state | TEXT | `usable`, `readonly`, `retired`, `rejected` |
| cursor | BIGINT | Last processed leaf index |
| checkpoint | TEXT | For static CT: last verified checkpoint |
| first_seen | TIMESTAMPTZ | When we started tracking this log |
| updated_at | TIMESTAMPTZ | |

### Table: `domain_events`
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| cert_fingerprint | TEXT | SHA-256 of the DER certificate |
| registrable_domain | TEXT | Normalized eTLD+1 |
| log_id | TEXT | Which log reported this |
| leaf_index | BIGINT | Position in the log |
| san_entries | TEXT[] | All SANs from the certificate |
| not_before | TIMESTAMPTZ | Certificate validity start |
| not_after | TIMESTAMPTZ | Certificate validity end |
| issuer | TEXT | Issuer organization |
| first_seen_at | TIMESTAMPTZ | When we first observed this |
| created_at | TIMESTAMPTZ | |

**Idempotency key:** `(cert_fingerprint, registrable_domain)` — enforced via a unique constraint.

### Table: `api_keys`
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| key | TEXT | The API key (hashed) |
| name | TEXT | Human label |
| tier | TEXT | `free`, `pro` |
| usage_count | BIGINT | Requests this period |
| usage_limit | BIGINT | Max requests per period |
| period_start | TIMESTAMPTZ | Start of current usage window |
| created_at | TIMESTAMPTZ | |
| revoked_at | TIMESTAMPTZ | Null if active |

---

## Phase Breakdown

### Phase 1: Core + Runnable by Strangers

**Goal:** `docker compose up` gives you a functioning system with sample data.

Deliverables:
1. `docker-compose.yml` with services: Postgres (local), CT consumer, Next.js, seed script
2. Rust CT consumer that connects to Postgres, fetches the CT log list, and begins forward-only consumption from one log
3. Next.js API route: `GET /api/v1/leads` returns domains from Postgres
4. Seed script that fills `domain_events` with sample data so the API returns results without a running CT consumer
5. `MIT LICENSE` file at repo root (the repo's own one, not the monorepo's)
6. Updated `README.md` with 2-command setup

**No auth in Phase 1** — the API is open. Phase 1 is about proving the pipeline end-to-end.

### Phase 2: Freemium API

**Goal:** API keys, usage limits, public API surface.

Deliverables:
1. `api_keys` table and key generation
2. Next.js middleware that checks API keys and enforces usage limits
3. Rate limiting headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`)
4. Pricing tier: free tier (e.g. 500 lookups/month), pro tier (unlimited, requires billing — deferred to Phase 3)
5. `POST /api/v1/subscribe` replaces the current Flask endpoint
6. Remove Flask backend and all V1 dependencies (Astra DB, Kafka, Abstract API, Notion, Moesif, Firebase)

### Phase 3: Publish

**Goal:** Ship to the world.

Deliverables:
1. Deploy documentation (Neon + Vercel)
2. Remove `(internal)` directory and other V1 cruft
3. Social preview image for GitHub
4. Resolve the `nrd-poll` 404 in README
5. Announce / changelog

---

## CT Consumer Worker Design

**Language:** Rust. Libraries: `tokio` (async runtime), `reqwest` (HTTP), `sqlx` (Postgres), `x509-parser` (certificate parsing), `rustls` + `webpki` (certificate chain verification).

**Startup sequence:**
1. Fetch Chrome CT log list from `https://www.gstatic.com/ct/log_list/v3/all_logs_list.json`
2. Validate signatures using Chrome's public key
3. Filter to `usable` + `readonly` logs
4. Load per-log cursors from `ct_logs` table
5. For each log, spawn an async task that begins forward consumption

**Per-log loop (RFC 6962):**
1. `GET <log_url>/ct/v1/get-sth` -> signed tree head
2. `GET <log_url>/ct/v1/get-entries?start=<cursor>&end=<cursor+page_size>` (page_size from log response)
3. Parse each entry: validate Merkle proof, extract certificate/pre-certificate
4. Extract SANs, normalize to registrable domains
5. UPSERT into `domain_events` with idempotency key
6. Update cursor in `ct_logs` only after durable commit
7. Retry with exponential backoff on 429/5xx

**Per-log loop (Static CT API):**
1. `GET <log_url>/checkpoint` -> signed checkpoint
2. Download tile: `<log_url>/tile/entries/<tile_number>-<0..255>.data`
3. Each tile is 256 entries at 256 bytes each (65,536 bytes per tile)
4. Extract certificates, same pipeline as RFC 6962
5. Advance checkpoint on durable commit

**Reliability:**
- Retry with jitter on rate limits (start at 10s, cap at 5min)
- If a log returns 404/410, mark it `retired` in `ct_logs` and stop polling
- Log lag metric: `(sth_timestamp - now)` — alert if > 1 hour
- Checkpoint to Postgres every N entries (configurable, default 100)
- Panic/recovery: on restart, resume from last durable cursor

---

## docker-compose Design

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: leadsdb
      POSTGRES_PASSWORD: leadsdb_dev
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./migrations:/docker-entrypoint-initdb.d

  ct-consumer:
    build: ./ct-consumer
    environment:
      DATABASE_URL: postgres://postgres:leadsdb_dev@db:5432/leadsdb
    depends_on:
      - db
    restart: unless-stopped

  seed:
    build: ./seed
    environment:
      DATABASE_URL: postgres://postgres:leadsdb_dev@db:5432/leadsdb
    depends_on:
      - db
    profiles:
      - seed  # run with: docker compose --profile seed run seed

  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgres://postgres:leadsdb_dev@db:5432/leadsdb
    depends_on:
      - db

volumes:
  pgdata:
```

**Usage:**
```bash
# Everyone:
docker compose up

# With sample data (no CT consumer needed):
docker compose --profile seed run seed
docker compose up
```

## License

MIT. An actual `LICENSE` file at repo root with the MIT license text. The README has been showing "MIT" since 2024 and 8 forks exist under that notice. Ratifying it is additive and honest.

---

## Non-Goals (Phase 1)

- No user accounts or auth
- No email blasts
- No HubSpot/Salesforce integration
- No backfill of historical CT data
- No company enrichment (Abstract API replacement deferred)
- No webhook delivery
- No billing or payment processing
