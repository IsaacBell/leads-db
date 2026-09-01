#!/usr/bin/env bash
set -euo pipefail

die() {
  local reason="$1"
  echo ""
  echo "  ============================================================"
  echo "  TEMP-FILE WRITE DETECTED"
  echo "  ============================================================"
  echo ""
  echo "  $reason"
  echo ""
  echo "  Temp files are banned in this repo. Use in-repo locations:"
  echo "    writing/tasks/     — per-writing-task briefs and artifacts"
  echo "    docs/              — documentation and operational files"
  echo "    recordings/        — asciinema casts and session captures"
  echo "    apps/<app>/tasks/  — app-scoped working files"
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
  echo "Usage: guard-temp-files.sh <command-string>"
  echo "       echo '<command-string>' | guard-temp-files.sh"
  exit 0
fi

# Redirects to temp paths: > /tmp/...   >> /tmp/...   2>/tmp/...   &>/tmp/...
if [[ "$INPUT" =~ [[:space:]][12]?">>"?[[:space:]]*/tmp/ ]] || \
   [[ "$INPUT" =~ [[:space:]]"&>?"[[:space:]]*/tmp/ ]] || \
   [[ "$INPUT" =~ [[:space:]][12]?">>"?[[:space:]]*/private/tmp/ ]] || \
   [[ "$INPUT" =~ [[:space:]]"&>?"[[:space:]]*/private/tmp/ ]]; then
  die "Redirect to /tmp or /private/tmp detected."
fi

# tee to temp paths
if [[ "$INPUT" =~ tee[[:space:]]+/tmp/ ]] || \
   [[ "$INPUT" =~ tee[[:space:]]+/private/tmp/ ]]; then
  die "tee to /tmp or /private/tmp detected."
fi

# mktemp without repo-scoped --tmpdir (defaults to /tmp)
if [[ "$INPUT" =~ (^|[[:space:]])mktemp($|[[:space:]]) ]]; then
  if ! [[ "$INPUT" =~ --tmpdir[[:space:]]*=[[:space:]]*[^[:space:]]+ ]]; then
    die "Bare mktemp (defaults to /tmp). Use: mktemp --tmpdir=./path ..."
  fi
fi

# cp/mv/touch/mkdir/install targeting /tmp or /private/tmp
if [[ "$INPUT" =~ (^|[[:space:]])(cp|mv|touch|mkdir|install)[[:space:]]+.*(/tmp/|/private/tmp/) ]]; then
  die "File operation targeting /tmp or /private/tmp detected."
fi

# --output flag pointing to temp (common in cli tools)
if [[ "$INPUT" =~ --output[[:space:]]*[=[:space:]][[:space:]]*/tmp/ ]] || \
   [[ "$INPUT" =~ --output[[:space:]]*[=[:space:]][[:space:]]*/private/tmp/ ]]; then
  die "--output flag pointing to /tmp or /private/tmp detected."
fi

exit 0
