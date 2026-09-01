#!/usr/bin/env bash
set -euo pipefail

BANNED=("npx" "npm" "bun" "bunx")

suggest() {
  local banned="$1"
  local rest="$2"
  case "$banned" in
    npx)  echo "    → pnpm dlx $rest";;
    npm)
      if [[ "$rest" =~ ^exec ]]; then
        echo "    → pnpm dlx ${rest#exec }"
      elif [[ "$rest" =~ ^run ]]; then
        echo "    → pnpm ${rest}"
      else
        echo "    → pnpm $rest"
      fi
      ;;
    bun)
      if [[ "$rest" =~ ^x ]]; then
        echo "    → pnpm dlx ${rest#x }"
      elif [[ "$rest" =~ ^run ]]; then
        echo "    → pnpm ${rest}"
      else
        echo "    → pnpm $rest"
      fi
      ;;
    bunx) echo "    → pnpm dlx $rest";;
  esac
}

die() {
  local banned="$1"
  local rest="$2"
  echo ""
  echo "  ============================================================"
  echo "  BANNED COMMAND DETECTED: $banned"
  echo "  ============================================================"
  echo ""
  echo "  The command '$banned' is banned in this repo (pnpm + Deno only)."
  echo ""
  echo "  Try instead:"
  suggest "$banned" "$rest"
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
  echo "Usage: guard-pnpm.sh <command-string>"
  echo "       echo '<command-string>' | guard-pnpm.sh"
  exit 0
fi

WORDS=($INPUT)

for i in "${!WORDS[@]}"; do
  base=$(basename "${WORDS[$i]}" 2>/dev/null || echo "${WORDS[$i]}")
  for banned in "${BANNED[@]}"; do
    if [[ "$base" == "$banned" ]]; then
      rest="${WORDS[*]:$i+1}"
      die "$banned" "$rest"
    fi
  done
done
