#!/usr/bin/env bash
set -euo pipefail

die() {
  local reason="$1"
  echo ""
  echo "  ============================================================"
  echo "  BROAD FIND DETECTED"
  echo "  ============================================================"
  echo ""
  echo "  $reason"
  echo ""
  echo "  Unscoped 'find' from the repo root is banned — it overloads tools."
  echo "  Use scoped paths or the justfile instead:"
  echo "    find ./apps/...   find ./scripts/...   find ./docs/..."
  echo "    just storefront-check    (IOC scan + lint + typecheck)"
  echo ""
  echo "  ============================================================"
  echo ""
  exit 1
}

if [[ -n "${1:-}" ]]; then
  INPUT="$1"
elif [[ ! -t 0 ]]; then
  INPUT=$(cat)
else
  echo "Usage: guard-broad-find.sh <command-string>"
  echo "       echo '<command-string>' | guard-broad-find.sh"
  exit 0
fi

# Normalize whitespace
CMD=$(echo "$INPUT" | tr -s ' ')

# find with no path argument (defaults to .)
if [[ "$CMD" =~ ^[[:space:]]*find[[:space:]]+ ]]; then
  # Strip 'find' and look at the first token
  REST="${CMD#*find }"
  REST="${REST## }"
  FIRST="${REST%% *}"
  # If first token starts with -, it's a flag not a path (implicit .)
  if [[ "$FIRST" =~ ^- ]]; then
    die "Unscoped 'find' — defaults to repo root '.'"
  fi
  # If first token is ., it's repo root
  if [[ "$FIRST" == "." ]]; then
    die "Unscoped 'find .' from repo root."
  fi
fi

exit 0
