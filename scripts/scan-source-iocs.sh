#!/usr/bin/env bash
set -euo pipefail

source_roots=()
for candidate in apps scripts packages; do
  if [[ -d "$candidate" ]]; then
    source_roots+=("$candidate")
  fi
done

if [[ ${#source_roots[@]} -eq 0 ]]; then
  echo "No source roots found to scan."
  exit 0
fi

source_globs=(
  --glob '*.ts'
  --glob '*.tsx'
  --glob '*.js'
  --glob '*.jsx'
  --glob '*.mjs'
  --glob '*.cjs'
  --glob '!**/node_modules/**'
  --glob '!**/.next/**'
  --glob '!**/.turbo/**'
)

patterns=(
  'eval\("global\.o='
  'global\.o='
  'atob\('
  "global\.i[[:space:]]*=[[:space:]]*['\"][^'\"]+['\"]"
  '_\$_46e0'
  'oWN\(5586\)'
  'lyR\('
  'BwP=283-272'
  "global\[['\"]_V['\"]\]"
  "global\[['\"]!['\"]\]"
  '(export default|module\.exports).*[[:space:]]{120,}[^[:space:]]'
)

found=0

for pattern in "${patterns[@]}"; do
  matches=$(rg -n --no-heading "$pattern" "${source_globs[@]}" "${source_roots[@]}" 2>/dev/null | grep -v 'ioc-ok:' || true)
  if [[ -n "$matches" ]]; then
    echo "$matches"
    found=1
  fi
done

config_files=()
while IFS= read -r file; do
  config_files+=("$file")
done < <(
  rg --files "${source_roots[@]}" \
    --glob '*config*.ts' \
    --glob '*config*.js' \
    --glob '*config*.mjs' \
    --glob '*config*.cjs' \
    --glob '!**/node_modules/**' \
    --glob '!**/.next/**' \
    --glob '!**/.turbo/**'
)

for file in "${config_files[@]}"; do
  if awk 'length($0) > 1200 { printf "%s:%d:%d\n", FILENAME, NR, length($0); exit 1 }' "$file"; then
    :
  else
    found=1
  fi
done

if [[ "$found" -ne 0 ]]; then
  echo "Potential source IOC patterns found."
  exit 1
fi

echo "No source IOC patterns found."
