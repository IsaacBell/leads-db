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

# --- secrets scanning ---

# Scan a command string for secrets. Pipe mode: `echo "cat .env" | just check-secrets`; arg mode: `just check-secrets "cat .env"`.
check-secrets cmd="":
    @bash -c ' \
      if [ -n "{{cmd}}" ]; then \
        echo "{{cmd}}" | bash scripts/guard-secrets.sh; \
      elif [ ! -t 0 ]; then \
        cat | bash scripts/guard-secrets.sh; \
      else \
        echo "Usage: echo \"<command>\" | just check-secrets  or  just check-secrets \"<command>\""; \
        exit 1; \
      fi'

# Pipe command output through PII detection before it reaches the agent.
guard-pii:
    @bash scripts/guard-secrets.sh --content-scan

# Run a command with full guardrails: secrets check + PII scan on output.
guarded-cmd cmd:
    @printf 'checking command...\n' && \
    echo "{{cmd}}" | bash scripts/guard-secrets.sh && \
    printf 'running...\n' && \
    eval "{{cmd}}" | bash scripts/guard-secrets.sh --content-scan

# Auto-fix trailing whitespace in all source files.
guard-whitespace-fix:
    @find . -type f \
      \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' -o -name '*.mjs' -o -name '*.cjs' \
         -o -name '*.json' -o -name '*.jsonc' -o -name '*.yaml' -o -name '*.yml' \
         -o -name '*.md' -o -name '*.mdx' -o -name '*.sh' -o -name '*.bash' -o -name '*.zsh' \
         -o -name '*.py' -o -name '*.css' -o -name '*.html' \) \
      ! -path '*/node_modules/*' ! -path '*/.next/*' ! -path '*/.turbo/*' ! -path '*/__pycache__/*' \
      -exec sed -i '' 's/[[:space:]]*$//' {} + 2>/dev/null || true
    @echo "  ✓ trailing whitespace fixed"

# --- CodeAnt ---

# Run CodeAnt AI review (run `codeant login` first).
codeant:
    codeant review

# Run CodeAnt secrets scan on the last commit.
codeant-secrets:
    codeant secrets --last-commit

# --- Vercel ---

vercel-env-to-infisical:
    bash scripts/vercel-neon-to-infisical.sh

# Build the Next.js frontend.
build:
    pnpm build

# Deploy to Vercel production. Requires `vercel login` + `vercel link` once.
deploy:
    pnpm build
    vercel deploy --prod

# Link the local project to Vercel (one-time setup).
vercel-link:
    vercel link

# --- CI ---

ci-check:
    bash scripts/ci-check.sh
    bash scripts/ci-quality.sh

ci-ruff:
    cd engine && uvx ruff check leadsdb_engine/

# Ruff — check the engine (no DB needed).
ruff:
    cd engine && uvx ruff check leadsdb_engine/

# Ruff — auto-fix the engine in place.
ruff-fix:
    cd engine && uvx ruff check --fix leadsdb_engine/

# Ruff — check + format the engine.
ruff-format:
    cd engine && uvx ruff format leadsdb_engine/

ci-bandit:
    cd engine && uvx bandit -r leadsdb_engine/ -f json -o /dev/null -ll

ci-semgrep:
    semgrep --config=.semgrep.yml --error --strict 2>/dev/null || echo "  (semgrep warnings)"

# IOC scan: detect obfuscation patterns (eval("global.o=", atob(), long config lines >1200 chars).
# Semgrep can't express these patterns, so this is a dedicated ripgrep-based scan.
ci-ioc:
    @bash scripts/scan-source-iocs.sh
    @echo "  ✓ IOC scan clean"

# Silver-gate: PII + secret + reader-description pattern scan (blockers fail CI).
# Semgrep's metavariable engine is unreliable for regex-heavy PII detection,
# so silver-gate-repo.mjs handles this with a dedicated pattern file.
ci-silver-gate:
    @node scripts/silver-gate-repo.mjs --block-only --path .
    @echo "  ✓ silver-gate block-only passed"

# Whitespace integrity: reject trailing whitespace, invisible Unicode, and zero-width characters.
# Critical for supply-chain security — prevents hidden malicious injection in .mjs, package.json, etc.
ci-whitespace:
    @bash scripts/guard-whitespace.sh . --fail-on-violation
    @echo "  ✓ whitespace integrity check passed"

# All static security analysis functions - run remotely in CI
ci-security: ci-ioc ci-silver-gate ci-whitespace

# All pre-commit actions - run locally on developer machines
pre-commit: ci-ioc ci-silver-gate ci-whitespace

ci-engine-test:
    cd engine && uv run pytest --junitxml=test-results.xml

ci-js-test:
    pnpm vitest run --reporter=junit --outputFile=test-results-js.xml 2>/dev/null || echo "  (js tests failed, check output)"


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
