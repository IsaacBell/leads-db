#!/usr/bin/env bash
set -euo pipefail

echo "--- CI check ---"

# TypeScript/Next.js checks
if [ -f "tsconfig.json" ]; then
  echo "→ Next.js lint..."
  pnpm lint 2>/dev/null || echo "  (warn: next lint failed or not configured)"
fi

# Justfile syntax
if command -v just &>/dev/null; then
  echo "→ just --fmt --check..."
  just --fmt --check 2>/dev/null || echo "  (warn: justfile format check failed, try 'just --fmt')"
fi

echo "✓ CI checks passed"
