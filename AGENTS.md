# leads-db Agent Rules

## PII / Secret Guard (Always-On, Non-Negotiable)

The sub-harness at `scripts/guard-secrets.sh` enforces PII/secret protection in agent output. It is always active.

### Never Do These

- **Never print personal names** (Ike, Isaac, Jamila, or any client/family names).
- **Never print emails, phone numbers, SSNs, street addresses**.
- **Never print family/relationship references** (my mom, dad, wife, son, daughter, sister, brother, etc.).
- **Never print internal role references** (trainee, apprentice).
- **Never print compensation** (`$X/hr`, `$X/year`, etc.).
- **Never read `.env` files, `credentials/` directories, or any secret files.**
- **Never run bare `env`, `printenv`, or `export`** — these dump the whole environment.
- **Never run `vercel env pull`** — this writes secrets to disk.
- **Never run `infisical secrets`, `infisical get`, `infisical export`, or any `infisical` command except `infisical run`.**
- **Never use `pg_dump`/`psql`/`pg_restore` with inline connection strings.**

### How to Use a Secret

```
infisical run --env dev --path /leads-db -- <cmd>
```

From the root gridlab workspace: `just leadsdb-run ...` (which wraps the above).

### How to Guard Risky Command Output

```
just check-secrets "<command-string>"
just guard-pii
```

These recipes are defined in `apps/leads-db/justfile`.

---

## Package Manager

- **pnpm only.** `npx`, `npm`, `bun`, `bunx` are banned. Use `pnpm dlx` instead of `npx`.

## Code Style

- **Indentation:** 2 spaces.
- **Semicolons:** required.
- **Quotes:** double quotes for strings.
- **Trailing commas:** on multi-line objects and arrays.
- **TypeScript** for all new JavaScript/TS code.
- **Python:** keep notebooks in `notebooks/`; engine code at `engine/`; ruff-clean (`cd engine && uvx ruff check leadsdb_engine/`).

## Architecture

- **Multi-tenant:** via `workspace_id` column.
- **Soft-delete:** via `deleted_at` column; queries in `db.py` filter `deleted_at IS NULL` by default.
- **PII masking:** read operations mask PII through `pii.py`. Add `--reveal` flag only with a TTY warning.
- **Tests:** no live database required — assert on model shapes and SQL strings.

## Startup Contract

For the full workspace startup contract, see `docs/session-start.md` at the gridlab root (`/Users/ike/Documents/gridlab/docs/session-start.md`).

## Pointer to Shared Rules

The full shared guard rules + hook infra live at the gridlab root in `scripts/guard-secrets.sh`. This file (`AGENTS.md`) is leads-db's local restatement for standalone use — when leads-db is cloned on its own, the sub-harness at `scripts/guard-secrets.sh` provides the same protection.
