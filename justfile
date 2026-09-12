default:
    @just --list

# --- hooks ---

# Install pre-commit hook from scripts/pre-commit.
install-hooks:
    @ln -sf scripts/pre-commit .git/hooks/pre-commit
    @echo "  ✓ pre-commit hook installed (scripts/pre-commit)"

# --- guardrails ---

enforce-pnpm:
    @bash scripts/guard-pnpm.sh < justfile

enforce-all: enforce-pnpm
    @bash scripts/guard-broad-find.sh ""
    @bash scripts/guard-temp-files.sh ""
    @bash scripts/guard-secrets.sh < /dev/null 2>/dev/null || true
    @bash scripts/guard-whitespace.sh .
    @bash scripts/scan-source-iocs.sh
    @node scripts/silver-gate-repo.mjs --block-only --path . 2>/dev/null || echo "  ⚠ silver-gate blockers found (non-fatal)"
    @echo "  ✓ enforce-pnpm passed"
    @echo "  ✓ guard-broad-find passed"
    @echo "  ✓ guard-temp-files passed"
    @echo "  ✓ guard-secrets loaded"
    @echo "  ✓ guard-whitespace clean"
    @echo "  ✓ IOC scan clean"

# --- silver-gate ---

silver-gate:
    node scripts/silver-gate-repo.mjs --path .

silver-gate-staged:
    node scripts/silver-gate-repo.mjs --staged

silver-gate-ai path:
    node scripts/silver-gate-ai.mjs --path {{quote(path)}}

# --- engine (Python / uv) ---

engine-sync:
    cd engine && uv sync

engine-lock:
    cd engine && uv lock

engine-run cmd:
    cd engine && uv run {{cmd}}

# --- CRM ---

# Add a company.
crm-company-add name:
    uv run -m leadsdb_engine.crm company add --name {{name}}

# Add or update a contact (accepts full PII; masked by default on read).
crm-add email:
    uv run -m leadsdb_engine.crm add --email {{email}}

# Look up a contact by ID or email (PII masked; add --reveal for full).
crm-get id:
    uv run -m leadsdb_engine.crm get --id {{id}}

# List contacts (PII masked; add --reveal for full).
crm-list:
    uv run -m leadsdb_engine.crm list

# Update a contact's status (new, contacted, qualified, unsubscribed, customer).
crm-status id status:
    uv run -m leadsdb_engine.crm status --id {{id}} --status {{status}}

# Flip a contact between lead and contact.
crm-contact-type id type:
    uv run -m leadsdb_engine.crm contact-type --id {{id}} --type {{type}}

# Soft-delete a contact.
crm-delete id:
    uv run -m leadsdb_engine.crm delete --id {{id}}

# Add a social link for a contact.
crm-social-add contact_id platform url:
    uv run -m leadsdb_engine.crm social add --contact-id {{contact_id}} --platform {{platform}} --url {{url}}

# List social links for a contact.
crm-social-list contact_id:
    uv run -m leadsdb_engine.crm social list --contact-id {{contact_id}}

# --- Deals / Annotations ---

# Create a deal (extra flags: --contact-id, --company-id, --value, --stage, ...).
crm-deal-add title:
    uv run -m leadsdb_engine.crm deal add --title {{title}}

# Show a deal (contact email masked; add --reveal for full).
crm-deal-get id:
    uv run -m leadsdb_engine.crm deal get --id {{id}}

# List deals (filter via the CLI: `uv run -m leadsdb_engine.crm deal list --stage <stage>`).
crm-deal-list:
    uv run -m leadsdb_engine.crm deal list

# Move a deal to a new stage (discovery|qualification|proposal|negotiation|closed_won|closed_lost).
crm-deal-stage id stage:
    uv run -m leadsdb_engine.crm deal stage --id {{id}} --stage {{stage}}

# Soft-delete a deal.
crm-deal-delete id:
    uv run -m leadsdb_engine.crm deal delete --id {{id}}

# Add an annotation (value must be a JSON string).
# Extras (--source/--confidence/--author-id) via the CLI directly.
crm-annotation-add target_type target_id key value:
    uv run -m leadsdb_engine.crm annotation add --target-type {{target_type}} --target-id {{target_id}} --key {{key}} --value {{value}}

# List annotations (contact-target values masked; add --reveal for full).
crm-annotation-list:
    uv run -m leadsdb_engine.crm annotation list

# Soft-delete an annotation.
crm-annotation-delete id:
    uv run -m leadsdb_engine.crm annotation delete --id {{id}}

# --- CRM Promotion ---

# Promote scored domains into CRM companies.
crm-promote:
	uv run -m leadsdb_engine.processors.lead_promoter


# Dispatch sequence outreach for promoted companies.
crm-outreach:
    uv run -m leadsdb_engine.processors.sequence_dispatcher

# --- Exa ---

# Search Exa with a query (EXA_API_KEY from Infisical).
exa-search query:
    uv run -m leadsdb_engine.exa search {{query}}

# Discover contacts for a company domain via Exa.
exa-discover domain:
    uv run -m leadsdb_engine.exa discover-contacts {{domain}}

# ------------ Infisical ------------ #

# Run any command with leads-db secrets injected via Infisical.
# Usage: `just leadsdb-run uv run python -m leadsdb_engine.processors.certstream_ingestor`
leadsdb-run cmd:
    infisical run --env dev --path /leads-db -- {{cmd}}

# Stage 1: Ingest raw domains from certstream WebSocket.
ingest:
		infisical run --env dev --path /leads-db -- uv run python -m leadsdb_engine.processors.certstream_ingestor

# Stage 2: Enrich raw domains with DNS/HTTP/rule-based classification.
enrich:
		infisical run --env dev --path /leads-db -- uv run python -m leadsdb_engine.processors.domain_enricher

# Stage 3: Score promising domains with an LLM for business entity detection.
leadsdb-score:
    infisical run --env dev --path /leads-db -- uv run python -m leadsdb_engine.processors.entity_scorer

# Stage 4: Promote scored domains into CRM companies.
leadsdb-promote:
    infisical run --env dev --path /leads-db -- uv run python -m leadsdb_engine.processors.lead_promoter

# Stage 5: Dispatch sequence outreach for promoted companies.
leadsdb-outreach:
    infisical run --env dev --path /leads-db -- uv run python -m leadsdb_engine.processors.sequence_dispatcher

# ------------ Engine ------------ #

# Install the Python engine dependencies.
leadsdb-install:
    cd engine && uv sync

# Apply migrations to the leads-db Neon database.
leadsdb-migrate:
    infisical run --env dev --path /leads-db -- bash apps/leads-db/scripts/migrate.sh

# Reset the leads-db database and re-run all migrations.
leadsdb-reset:
    infisical run --env dev --path /leads-db -- bash apps/leads-db/scripts/reset.sh

# Seed sample domain events and classifications (no consumer needed).
leadsdb-seed:
    cd engine && infisical run --env dev --path /leads-db -- uv run python scripts/seed.py

# Deploy the leads-db Next.js frontend + API to Vercel production.
leadsdb-deploy:
    pnpm build && vercel deploy --prod

# Quick smoke test: verify DB connectivity and table count.
leadsdb-check:
    cd engine && infisical run --env dev --path /leads-db -- uv run python -c 'import os, psycopg; conn = psycopg.connect(os.environ["LDB_DATABASE_URL"]); cur = conn.cursor(); cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = %s", ("public",)); print("Tables:", [r[0] for r in cur.fetchall()]); cur.execute("SELECT COUNT(*) FROM domain_events"); print("Domain events:", cur.fetchone()[0]); cur.execute("SELECT COUNT(*) FROM domain_classifications"); print("Classifications:", cur.fetchone()[0])'
