#!/usr/bin/env bash
# Drop and recreate the public schema, then re-apply all migrations.
# This script is run under `infisical run` so LDB_DATABASE_URL is set.
set -euo pipefail

echo "WARNING: This will DROP ALL DATA in the leads-db database."
echo "Continue? (y/N)"
read -r confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
  echo "Aborted."
  exit 1
fi

psql "$LDB_DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
echo "Schema dropped and recreated."

migration_dir="$(cd "$(dirname "$0")/../migrations" && pwd)"
for f in "$migration_dir"/*.sql; do
  echo "Applying $(basename "$f")..."
  psql "$LDB_DATABASE_URL" -f "$f"
  echo "  done"
done

echo "✓ Database reset and migrations applied"
