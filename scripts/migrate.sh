#!/usr/bin/env bash
# Apply all SQL migrations to the leads-db Neon database.
# This script is run under `infisical run` so LDB_DATABASE_URL is set.
set -euo pipefail

migration_dir="$(cd "$(dirname "$0")/../migrations" && pwd)"

for f in "$migration_dir"/*.sql; do
  echo "Applying $(basename "$f")..."
  psql "$LDB_DATABASE_URL" -f "$f"
  echo "  done"
done

echo "✓ All migrations applied"
