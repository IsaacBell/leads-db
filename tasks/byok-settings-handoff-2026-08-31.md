# LeadsDB V2 — BYOK Settings Handoff (fix the CLI → Web UI mistake)

**Date:** 2026-08-31
**Author:** Zed Agent (GLM-5.2)
**For:** DeepSeek Flash (or whoever picks this up next)
**Scope:** BYOK inference + outreach settings. The previous agent (me) built a correct encryption + settings-table foundation but got the *user-facing layer* wrong — it built a Python CLI (`settings.py`) when settings belong in the Next.js web UI the way Perplexica does it.

**Read this whole file before touching anything.** Ike has corrected the same class of mistake four times this session; do not repeat it.

---

## 1. The product direction (non-negotiable)

LeadsDB V2 is being **open-sourced** (`github.com/IsaacBell/leads-db`, same repo, main branch, MIT). Strangers clone it and run it. That shapes everything:

- **Bring-your-own-key, fully agnostic.** Users supply their *own* AI inference endpoint + model + key. No provider is baked in — not OpenAI, not DeepInfra, not Vercel AI Gateway, not Ollama. Ike *uses* DeepInfra and Vercel personally, but the OSS product must work with any OpenAI-compatible endpoint. Perplexica is the reference shape: a user opens a settings page, pastes endpoint + key, it works.
- **No localhost / Ollama defaults anywhere.** The previous-previous agent hardcoded `http://localhost:11434` and `llama3.2` as scorer defaults. That is wrong for an OSS BYOK product. The scorer ships **blank** and idles until the user configures it. It never guesses a host.
- **Keys are NEVER stored in plaintext — not in env vars, not in SQL.** BYOK API keys are AES-256-GCM encrypted at rest in the `settings` table. The only secret outside the DB is the master encryption key (`LDB_SETTINGS_ENCRYPTION_KEY`).
- **No env vars for inference or pipeline tuning.** Only two env vars exist in the whole product: `LDB_DATABASE_URL` (the DB connection string — can't store the DB string *in* the DB) and `LDB_SETTINGS_ENCRYPTION_KEY` (the single bootstrap secret). Everything else — endpoint URL, model name, thresholds, batch sizes, workspace selectors, transport choice, API keys — lives in the `settings` table, read each processor cycle.
- **Outreach is vendor-agnostic.** Ike is NOT using Resend for cold email at scale. Resend is fine as one adapter behind a generic `EmailTransport` interface for *testing with Ike's own emails*. The **default transport is `noop`** (log-only). A fresh deploy cannot send cold email to anyone — safe-by-default for an OSS project.
- **Settings are USER-FACING, via the web UI — NOT a CLI.** This is the mistake you are here to fix. The previous agent built `engine/leadsdb_engine/settings.py` as a Python CLI (`uv run -m leadsdb_engine.settings set …`). That is the wrong layer: end-users of an OSS web product do not bootstrap a Python venv and run a CLI; they open `/settings` in the app. The Python CLI must be **removed** and replaced with a Next.js settings page + API route.

---

## 2. What the previous agent got WRONG (your first job: clean this up)

These exist in the tree now and must go:

1. **`engine/leadsdb_engine/settings.py`** — a Python argparse CLI for get/set/set-secret. **Delete it.** Settings writes happen from the Next.js API route, not Python.
2. **`justfile`** — the `settings-get` / `settings-list` / `settings-set` / `settings-set-secret` / `settings-transports` recipes added under the `# --- Settings (BYOK + pipeline tuning) ---` block. **Delete that whole block.** (Keep the `crm-promote` recipe that precedes it.)
3. **`engine/pyproject.toml`** — the `leadsdb-settings = "leadsdb_engine.settings:main"` entry added under `[project.scripts]`. **Delete that line.**
4. **`README.md`** — the "Configure your LLM (BYOK)" section currently tells users to run SQL `UPDATE settings …` and `just settings-set-secret …`. Replace those instructions with "open the **Settings** page in the app" once you've built the UI. (See §4.)
5. **`engine/tests/test_sequence_dispatcher.py`** — the `TestNoopTransportDefault.test_unknown_transport_raises` test uses a try/except/pass instead of `pytest.raises`. Minor; rewrite to use `pytest.raises(TransportError)`.

---

## 3. What the previous agent got RIGHT (KEEP — these are the foundation)

Do not revert or rewrite these. They are correct and tested.

### Encryption layer
- **`engine/leadsdb_engine/crypto.py`** — AES-256-GCM encrypt/decrypt. Ciphertext layout: `nonce(12 bytes) || ciphertext+tag`. Master key from `LDB_SETTINGS_ENCRYPTION_KEY` (urlsafe-base64, 32 bytes). `is_available()`, `encrypt(str)→bytes`, `decrypt(bytes)→str`, `CryptoError`. **87 tests pass** including `engine/tests/test_crypto.py` (round-trips, wrong-key rejection, nonce uniqueness, idle-without-key).

### Schema
- **`migrations/009_create_settings.sql`** — adds `encrypted_value BYTEA` + `is_secret BOOLEAN` to the `settings` table. Seeds the `scorer` / `enricher` / `promoter` / `outreach` categories. BYOK rows ship **empty** (`scorer_api_url=""`, `scorer_model=""`, `scorer_api_key` secret with NULL ciphertext). NO ollama, NO localhost, NO model name anywhere. **Migration is NOT yet applied to Neon** (V2-STATUS says even 005 was never applied) so you can still edit it freely if you need to add a column — but you probably don't.

### Python settings read/write helpers
- **`engine/leadsdb_engine/db.py`** — settings section at the bottom. Exports: `get_setting(key)→dict|None`, `get_settings_map(category)→{key:dict}`, `set_setting(key, **typed)`, `set_secret(key, plaintext|None, …)`. Secret rows decrypt transparently and surface as `secret_value`; raw ciphertext never leaves the module. UPSERT SQL preserves seeded label/description via COALESCE. These are the **read side** the Python processors use — keep them.

### Rewired processors (all read the settings table at cycle start, no env vars)
- **`engine/leadsdb_engine/processors/entity_scorer.py`** — single OpenAI-compatible `/chat/completions` path (no Ollama branch). `_load_config()` reads the `scorer` category. Idles with a clear log message if `scorer_api_url` or `scorer_model` is blank. Lenient JSON extraction (`_extract_json`) so it works across OpenAI / DeepInfra / Vercel AI Gateway / vLLM / llama.cpp / Ollama-OpenAI-compat.
- **`engine/leadsdb_engine/processors/lead_promoter.py`** — `_load_config()` reads `scorer_threshold` (single source of truth for lead quality) + `promoter_*` rows. No env vars.
- **`engine/leadsdb_engine/processors/domain_enricher.py`** — `_load_config()` reads `enricher_*` rows. `_resolve_dns` / `_fetch_page` now take timeouts as params.
- **`engine/leadsdb_engine/processors/sequence_dispatcher.py`** — `_load_config()` reads the `outreach` category. Builds the transport via the registry. `is_dispatchable()` pure guard kept.

### Outreach transports (generic adapter — the right shape)
- **`engine/leadsdb_engine/transports/`** package:
  - `base.py` — `EmailTransport` Protocol + `TransportError` + `TransportResult` dataclass.
  - `noop.py` — log-only default. `is_dry_run` is True. Masks recipient for logging.
  - `resend.py` — reference adapter for Ike's live testing. `is_dry_run` self-reports True when key is empty. Uses `httpx` (no third-party SDK).
  - `__init__.py` — `get_transport(name, *, api_key, from_addr)` + `available_transports()` + `_REGISTRY` dict. **Add future adapters by registering here.**
- **`engine/leadsdb_engine/resend.py`** — DELETED (was a hardcoded vendor module). Don't recreate it; the adapter lives in `transports/resend.py`.

### Dead code removed
- **`scripts/ai-gateway.mjs`** — DELETED (had baked-in provider presets incl. ollama/localhost; zero imports anywhere). Don't recreate it.
- **`package.json`** — renamed `"next-flask"` → `"leads-db"`.

### Docs (mostly correct; fix only the settings-config section)
- **`README.md`** — modernized with pills/badges (License/CI/Python/Next.js/Neon), table layouts, architecture diagram, BYOK security table, roadmap checklist. **Issues to fix:** the "Configure your LLM (BYOK)" section points at the CLI/SQL (see §2.4); and Ike wants a **Vercel deploy button** in the README ("deploy w/ vercel readme button") — not yet added. Add the standard `[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=…)` once the UI exists.
- **`V2-STATUS.md`** — the stale `ENTITY_SCORER_*` / `ENRICHER_*` / `RESEND_API_KEY` env-var table was replaced with the correct two-env-var table + a full `settings` table reference. Pipeline table updated to "BYOK" / "Pluggable transport". Fixed.

---

## 4. What you NEED TO BUILD (the actual remaining work)

The user-facing settings layer, in the Next.js app. Perplexica-shaped: a `/settings` page with a form, backed by API routes that read/write the `settings` table — encrypting secrets with the **same** algorithm the Python side decrypts.

### 4a. TypeScript crypto helper (CRITICAL — must interop with Python `crypto.py`)
The Next.js API route will write secrets; the Python processors will decrypt them on read. The two crypto implementations must produce/consume the **exact same** ciphertext. Port `engine/leadsdb_engine/crypto.py` to TS:

- Algorithm: **AES-256-GCM**.
- Key: urlsafe-base64-decode `LDB_SETTINGS_ENCRYPTION_KEY` → 32 bytes.
- Nonce: 12 random bytes, prepended to ciphertext.
- Output: `nonce(12) || ciphertext+tag` (same as Python). Node's `crypto.createCipheriv("aes-256-gcm", key, iv)` then `Buffer.concat([iv, cipher.update(plain), cipher.final(), cipher.getAuthTag()])` — **note the tag goes at the END in Node**, matching WebCrypto/AES-GCM convention; Python `cryptography`'s AESGCM puts the tag at the end of the ciphertext too, so they interop. **Verify with a round-trip test** (TS encrypt → Python decrypt AND Python encrypt → TS decrypt) before shipping. Put this at e.g. `libs/crypto.ts` or `utils/crypto.ts`. Master key from `process.env.LDB_SETTINGS_ENCRYPTION_KEY`.

### 4b. Next.js API routes
Follow the existing pattern in `app/api/v1/leads/route.ts` (uses `pg` `Pool` with `process.env.LDB_DATABASE_URL`, `export const dynamic = "force-dynamic"`). The V1 `libs/astraDb.ts` is dead — do NOT use it; it's the Cassandra client from V1 and gets removed in Phase 2.

- **`app/api/v1/settings/route.ts`**
  - `GET` → list all settings (group by category). Mask secrets (show first 4 + last 4 chars, or "(not set)"). This is what the settings page loads.
  - `POST` → set a **plain** setting (key + value). Infer the typed column from value shape (bool / int / float / text). Run the same `UPSERT_SETTING` SQL as Python `db.py` (port the SQL string — it's in `engine/leadsdb_engine/db.py`, search for `UPSERT_SETTING`).
- **`app/api/v1/settings/secrets/route.ts`** (or a sub-route)
  - `POST` → set a **secret** (key + plaintext). Encrypt with the TS crypto helper, then run `UPSERT_SECRET` SQL (port from `db.py`). Never store plaintext; never log the value.
  - `DELETE` (or POST with empty value) → clear a secret (set `encrypted_value = NULL`).

### 4c. Settings UI page
- **`app/settings/page.tsx`** — the user-facing form. Perplexica-style. Sections by category:
  - **LLM scoring (BYOK):** `scorer_api_url` (text), `scorer_model` (text), `scorer_api_key` (password field, write-only — don't echo the value back on GET, show "•••• set" or "not set" status).
  - **Enricher tuning:** batch size, concurrency, http/dns timeouts.
  - **Promoter:** interval, batch, workspace id.
  - **Outreach:** transport (select from `available_transports()` — expose via a GET endpoint or hardcode the registered list), from address, workspace id, interval, sequence (JSON textarea, optional). If transport is `noop`, show a "DRY-RUN — no email will be sent" notice. If `resend`, show the API key field.
- Submit posts to the API routes. Show success/error toasts (the project uses `notistack` — it's in `package.json`).

### 4d. Auth on the settings routes (MUST — this writes secrets)
The settings routes write encrypted BYOK keys to the DB. **They cannot be open.** V2-PLAN defers API-key auth middleware to Phase 2, but the settings endpoints specifically need protection *now* because they're the one route that accepts secrets. Simplest acceptable gate: an admin token check (`process.env.LEADSDB_ADMIN_TOKEN`, compared via a header or cookie) — or basic-auth-style single-user. Don't over-build; Ike hasn't specified a real auth model. Document whatever you choose in `V2-STATUS.md` under Remaining Gaps.

---

## 5. Validation state (as handed off)

- **`uv run --extra dev pytest -q`** → **87 passed, 2 failed**. The 2 failures (`test_db.py::TestDomainEventModel::test_rejects_empty_fingerprint`, `..._domain`) are **pre-existing and documented** in `V2-STATUS.md` — pydantic v2 doesn't reject empty strings by default. Not yours to fix unless you want to (add `min_length=1` to the model fields).
- **`uvx ruff check leadsdb_engine/`** → clean for all new/modified files. Remaining ruff warnings are pre-existing (`ARG001` on websocket/signal callbacks in `certstream_ingestor.py` / `base.py`, `ARG004` on `_classify_by_rules`'s unused `domain` param) — don't touch.
- **No tests exist for the TS settings routes yet** — add Vitest tests following the `__tests__/api/` pattern (dir exists but is sparse). At minimum: masking on GET, encrypt-then-store on secret POST, 401 when admin token missing.
- **Migration 009 is not applied to Neon.** Once the UI is wired, `just leadsdb-migrate` to apply 005–009.
- **The `engine` is not packaged** (`uv sync` warns "Skipping installation of entry points"). Don't try to fix that unless asked.

---

## 6. Concrete checklist (do these in order)

1. **Delete the wrong-layer CLI:**
   - [ ] `rm engine/leadsdb_engine/settings.py`
   - [ ] Remove the `# --- Settings (BYOK + pipeline tuning) ---` block (5 recipes) from `justfile`
   - [ ] Remove `leadsdb-settings = "leadsdb_engine.settings:main"` from `engine/pyproject.toml`
2. **Build the TS crypto helper** (`libs/crypto.ts` or `utils/crypto.ts`) mirroring `engine/leadsdb_engine/crypto.py`. Add a round-trip interop test (TS↔Python) in `engine/tests/` if practical, or at minimum a Vitest round-trip.
3. **Build `app/api/v1/settings/route.ts`** (GET list masked, POST plain) following the `leads/route.ts` pattern (`pg` Pool, `LDB_DATABASE_URL`). Port `UPSERT_SETTING` + `GET_SETTING`/`GET_SETTINGS_BY_CATEGORY` SQL from `engine/leadsdb_engine/db.py`.
4. **Build `app/api/v1/settings/secrets/route.ts`** (POST secret: encrypt with TS crypto → `UPSERT_SECRET`; DELETE/clear). Port `UPSERT_SECRET` SQL.
5. **Add the admin-token gate** to both settings routes. Document the env var (`LEADSDB_ADMIN_TOKEN`) — note this is a *third* env var now, which is fine (it's the admin gate, not inference config).
6. **Build `app/settings/page.tsx`** — the user-facing form (BYOK endpoint/model/password-key, enricher/promoter/outreach tuning, transport select with noop-DRY-RUN notice). Use `notistack` for feedback.
7. **Update `README.md`:** replace the "Configure your LLM (BYOK)" SQL/CLI instructions with "open the **Settings** page" once #6 exists. Add the **Vercel deploy button** to the badge row (`[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/IsaacBell/leads-db)`).
8. **Update `V2-STATUS.md`** Remaining Gaps: remove the "Settings CLI" bullet (it's gone), add "Settings UI + admin-token auth" as done once built, note `LEADSDB_ADMIN_TOKEN` env var.
9. **Add Vitest tests** for the settings routes (masking, secret round-trip, 401).
10. **Run `just ci-check`** and `uv run --extra dev pytest -q`; confirm 87+ pass and the 2 pre-existing are the only failures.

---

## 7. Things to NOT do

- Don't add API keys, endpoints, or model names as defaults anywhere. Empty/blank by default. The product idles until the user configures it.
- Don't reintroduce an Ollama branch, a `localhost` host, an env var for inference config, or a `RESEND_API_KEY` env var. Resend is one transport adapter chosen via the `outreach_transport` setting, default `noop`.
- Don't store secrets in plain text. Don't log secret values. Don't echo secret values on GET (mask them).
- Don't reference `ai-gateway.mjs` or `resend.py` (engine root) — both deleted. The transport adapter is `transports/resend.py`.
- Don't touch the Python processor internals in §3 — they're correct. The only Python you should write is deleting `settings.py`.
- Don't create a `docs/handoffs/` doc — this `tasks/` file is the handoff surface per repo rules. Durable decisions go to Serena memory (`mem:project/leads-db-v2`), not a new handoff doc.

---

## 8. Open questions for Ike (if you hit them — don't guess)

- Exact admin auth model (admin token vs. something heavier). I've defaulted to "admin token env var" in §4d; confirm with Ike if unsure.
- Whether the settings page should be part of the existing frontend nav or a separate admin surface.
- The Vercel deploy-button `repository-url` and any env-var prefill params to include.
- Whether to add more outreach transport adapters now, or wait until Ike picks a cold-email vendor.
