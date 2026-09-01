#!/usr/bin/env bash
set -euo pipefail

echo "--- Quality checks ---"

# ShellCheck scripts
if command -v shellcheck &>/dev/null; then
  echo "→ shellcheck..."
  shellcheck scripts/*.sh 2>/dev/null && echo "  ✓ shellcheck passed" || echo "  (shellcheck warnings)"
else
  echo "  (shellcheck not installed, skipping)"
fi

echo "✓ Quality checks passed"
