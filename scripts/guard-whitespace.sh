#!/usr/bin/env bash
# Guard against trailing whitespace, invisible Unicode, and zero-width characters
# in text files. These are supply-chain / injection vectors — malicious actors can
# hide code in trailing whitespace or zero-width joiners that render invisibly.
#
# Usage:
#   guard-whitespace.sh <path>               # scan path, exit 1 on violations
#   guard-whitespace.sh <path> --fail-on-violation  # same, explicit
#   guard-whitespace.sh <path> --list-only   # just list files, non-zero exit if violations
set -euo pipefail

target="${1:-.}"
mode="${2:-}"

if [[ ! -d "$target" && ! -f "$target" ]]; then
  echo "guard-whitespace: target not found: $target"
  exit 1
fi

HAS_VIOLATIONS=0

# Files to scan (text source files — skip binaries, generated, and vendor dirs)
scan_files() {
  if [[ -f "$target" ]]; then
    echo "$target"
  else
    find "$target" \
      -type f \
      \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' -o -name '*.mjs' -o -name '*.cjs' \
         -o -name '*.json' -o -name '*.jsonc' -o -name '*.yaml' -o -name '*.yml' \
         -o -name '*.toml' -o -name '*.md' -o -name '*.mdx' \
         -o -name '*.css' -o -name '*.scss' -o -name '*.html' \
         -o -name '*.sh' -o -name '*.bash' -o -name '*.zsh' \
         -o -name '*.py' -o -name '*.rs' -o -name '*.go' -o -name '*.java' \
         -o -name 'justfile' -o -name 'Makefile' -o -name 'Dockerfile' \) \
      ! -path '*/node_modules/*' \
      ! -path '*/.next/*' \
      ! -path '*/.turbo/*' \
      ! -path '*/__pycache__/*' \
      ! -path '*/.venv/*' \
      ! -path '*/venv/*' \
      ! -path '*/pnpm-lock.yaml' \
      ! -path '*/package-lock.json' \
      ! -path '*.sql' \
      ! -path '*.lock' \
      ! -path '*.log' \
      ! -path '*.svg' \
      ! -name '*.postman_collection.json' \
      ! -path '*/node_modules/*' \
      ! -path '*/.next/*' \
      ! -path '*/.turbo/*' \
      ! -path '*/__pycache__/*' \
      ! -path '*/.venv/*' \
      ! -path '*/venv/*'
  fi
}

while IFS= read -r file; do
  [ -z "$file" ] && continue
  [ ! -f "$file" ] && continue

  VIOLATIONS=0

  # 1. Trailing whitespace (space or tab at end of line)
  if rg -q --no-heading '[ 	]+$' "$file" 2>/dev/null; then
    if [ "$VIOLATIONS" -eq 0 ]; then
      echo ""
      echo "  ❌  $file"
    fi
    echo "      trailing whitespace"
    VIOLATIONS=$((VIOLATIONS + 1))
  fi

  # 2. Zero-width Unicode characters commonly used for injection
  #    U+200B (ZWSP), U+200C (ZWNJ), U+200D (ZWJ), U+FEFF (BOM),
  #    U+2060 (Word Joiner), U+2061-2064 (Invisible operators)
  if rg -q --no-heading $'[\u200B\u200C\u200D\uFEFF\u2060\u2061\u2062\u2063\u2064]' "$file" 2>/dev/null; then
    if [ "$VIOLATIONS" -eq 0 ]; then
      echo ""
      echo "  ❌  $file"
    fi
    echo "      invisible Unicode (zero-width / invisible characters)"
    VIOLATIONS=$((VIOLATIONS + 1))
  fi

  # 3. Confusable homoglyph characters (Cyrillic in ASCII contexts)
  #    Common: Cyrillic а, е, о, р, с, х that look identical to Latin
  if rg -q --no-heading $'[\u0430\u0435\u043E\u0440\u0441\u0445]' "$file" 2>/dev/null; then
    # Only flag if the file is not explicitly meant to contain them
    if ! rg -q --no-heading '(Cyrillic|homoglyph|intentional)' "$file" 2>/dev/null; then
      if [ "$VIOLATIONS" -eq 0 ]; then
        echo ""
        echo "  ❌  $file"
      fi
      echo "      confusable homoglyph characters (Cyrillic lookalikes in ASCII context)"
      VIOLATIONS=$((VIOLATIONS + 1))
    fi
  fi

  # 4. Tab characters in non-makefile files (inconsistent indentation)
  EXT="${file##*/}"
  if [[ "$EXT" != "Makefile" && "$EXT" != "makefile" && "$file" != *"Makefile"* ]]; then
    # Only flag .ts, .js, .json, .md, .py, .yaml — languages where tabs are unusual
    # Skip Postman collections (exported with tabs) and lock files.
    case "$file" in
      *.postman_collection.json|*.lock) ;;
      *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.json|*.jsonc|*.py|*.md|*.yaml|*.yml)
        if rg -q --no-heading $'\t' "$file" 2>/dev/null; then
          if [ "$VIOLATIONS" -eq 0 ]; then
            echo ""
            echo "  ❌  $file"
          fi
          echo "      tab character in source file (use spaces)"
          VIOLATIONS=$((VIOLATIONS + 1))
        fi
        ;;
    esac
  fi

  if [ "$VIOLATIONS" -gt 0 ]; then
    HAS_VIOLATIONS=1
  fi
done < <(scan_files)

if [ "$HAS_VIOLATIONS" -eq 1 ]; then
  echo ""
  if [[ "$mode" == "--fail-on-violation" ]]; then
    echo "  🛑  Whitespace integrity violations detected."
    echo "      Fix them before committing."
    echo ""
    exit 1
  else
    echo "  ⚠  Whitespace integrity violations found (non-fatal in local mode)."
    echo "      Fix with: just guard-whitespace-fix or manually."
    echo ""
    exit 0
  fi
fi

echo "  ✓ No whitespace integrity violations."
exit 0
