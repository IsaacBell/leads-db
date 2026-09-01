#!/usr/bin/env bash
# Guard against secret exposure and PII leakage in agent output.
#
# Modes:
#   1. Command guard:  echo "some command" | guard-secrets.sh
#   2. PreToolUse hook: receives tool-call JSON on stdin
#   3. Content scan:   command | guard-secrets.sh --content-scan
#      Scans stdin for PII and warns/block before output reaches the agent.
#
# PII patterns are drawn from silver-gate-patterns.json (Safe Harbor methodology).
set -uo pipefail

# --- PII patterns (core set; covers names, contacts, credentials) --------------
# These match Safe Harbor de-identification + personal names + internal references.
PII_BLOCK_PATTERNS=(
  # Personal names (you, clients, family)
  '(?i)\bIsaac\b'
  '(?i)\bIke\b'
  '(?i)\bJamila\b'
  '(?i)\bIsaac Bell\b'

  # Hard credentials
  'AKIA[0-9A-Z]{16}'
  '\bgh[pousr]_[A-Za-z0-9_]{36,}\b'
  'xox[baprs]-[A-Za-z0-9-]{10,}'
  'AIza[0-9A-Za-z_-]{35}'
  '[sr]k_(live|test)_[A-Za-z0-9]{24,}'
  'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}'
  '-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----'

  # US PII
  '(?<!\d)(?!000|666|9\d{2})\d{3}-(?!00)\d{2}-(?!0000)\d{4}(?!\d)'  # SSN
  '\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b'  # IP address
  '\b[\w.+-]+@[\w-]+\.[\w.]+'  # email (relaxed)

  # Financial account references
  '(?i)\b(account number|routing number|credit card|cvv|pin number|bank account)\s*[:=]'

  # Family / relationship references in possessive form
  '(?i)\bmy (mom|dad|mother|father|sister|brother|wife|husband|son|daughter|'
  'grandma|grandpa|aunt|uncle|cousin|niece|nephew|family|kid|child|children|'
  'parent|spouse|partner|girlfriend|boyfriend|fianc[ée]|roommate)\b'

  # Age references
  '\b\d{1,2}[ -]year[ -]old\b'
  '(?i)\b(date of birth|dob|birthdate|birth date)\b'

  # Internal role references
  '(?i)\b(trainee|apprentice)\b'

  # Compensation
  '(?i)\b\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?/(?:hr|hour|month|year|yr)\b'
)

PII_WARN_PATTERNS=(
  # Street addresses
  '\b\d+\s+[A-Z][a-z]+\s+(Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Court|Ct|Blvd|Way|Place|Pl|Circle|Cir|Trail|Trl|Parkway|Pkwy|Highway|Hwy|Boulevard|Loop)\b'

  # Phone numbers
  '\b\(?\d{3}\)?[-.\s]?\d{3}[-.]?\d{4}\b'

  # Patient / medical references
  '(?i)\b(medical record|mrn|patient id|health record|hipaa)\b'
)

# --- Mode detection -----------------------------------------------------------
MODE="command"  # default
if [ "${1:-}" = "--content-scan" ]; then
  MODE="content"
fi

# --- Content-scan mode: scan stdin for PII -----------------------------------
if [ "$MODE" = "content" ]; then
  input=$(cat)
  [ -z "$input" ] && exit 0

  # Check block patterns
  while IFS= read -r line; do
    for pattern in "${PII_BLOCK_PATTERNS[@]}"; do
      if printf '%s' "$line" | grep -Eq -- "$pattern" 2>/dev/null; then
        echo ""
        echo "  ============================================================"
        echo "  PII / SECRET DETECTED IN OUTPUT (BLOCKED)"
        echo "  ============================================================"
        echo ""
        printf '  Pattern matched: %s\n' "$pattern"
        printf '  Line: %s\n' "$line"
        echo ""
        echo "  ============================================================"
        echo ""
        exit 2
      fi
    done
  done <<< "$input"

  # Check warn patterns
  line_num=0
  while IFS= read -r line; do
    line_num=$((line_num + 1))
    for pattern in "${PII_WARN_PATTERNS[@]}"; do
      if printf '%s' "$line" | grep -Eq -- "$pattern" 2>/dev/null; then
        echo "  ⚠ PII WARNING (line $line_num): possible $pattern in output" >&2
      fi
    done
  done <<< "$input"

  # Pass through
  printf '%s' "$input"
  exit 0
fi

# --- Command-guard mode: inspect the command string for dangerous operations --
read -r first_line
rest=$(cat)
full_input="$first_line"$'\n'"$rest"

if printf '%s' "$first_line" | grep -q '^{'; then
  # Hook mode: extract command from tool_input JSON
  cmd=$(printf '%s' "$full_input" \
    | python3 -c 'import sys,json; print(json.load(sys.stdin).get("tool_input",{}).get("command",""))' 2>/dev/null)
else
  # Command-string mode
  cmd=$(printf '%s' "$full_input" | head -1)
fi

[ -z "$cmd" ] && exit 0

lc=$(printf '%s' "$cmd" | tr '[:upper:]' '[:lower:]')

block() {
  echo ""
  echo "  ============================================================"
  echo "  SECRET EXPOSURE BLOCKED"
  echo "  ============================================================"
  echo ""
  echo "  $1"
  echo ""
  echo "  To USE a secret:    infisical run -- <cmd>"
  echo "  To know a secret name:  read docs or ask the user"
  echo ""
  echo "  ============================================================"
  echo ""
  exit 2
}

warn() {
  echo ""
  echo "  ⚠ GUARD WARNING: $1" >&2
  echo "" >&2
}

# --- PII in the command itself (check raw text, not lowercased) ---
if printf '%s' "$cmd" | grep -Eq '(?i)\b(Ike|Isaac|Jamila)\b'; then
  block "Personal name detected in command. Names (Ike, Isaac, Jamila) must not appear in agent output."
fi
if printf '%s' "$cmd" | grep -Eq '(?i)\b(my (mom|dad|wife|husband|son|daughter|sister|brother|mother|father|family|kid|child|parent|spouse|partner|girlfriend|boyfriend))\b'; then
  block "Possessive family reference detected. This leaks personal information."
fi
if printf '%s' "$cmd" | grep -Eq '(?i)\b(trainee|apprentice)\b'; then
  block "Internal role reference (trainee/apprentice) must not appear in agent output."
fi
if printf '%s' "$cmd" | grep -Eq '\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b'; then
  block "Email address detected in command. Email addresses are PII."
fi

# --- CATCH-ALL: BLOCK every infisical command EXCEPT `infisical run` ---
# This is intentionally broad. infisical secrets, infisical export, infisical get,
# infisical folders, infisical list, infisical delete, infisical generate-example-env
# ALL print or can print secret values. The ONLY safe interaction is `infisical run -- <cmd>`
# which injects secrets into a subprocess without printing them.
if printf '%s' "$lc" | grep -Eq '\binfisical\b'; then
  if ! printf '%s' "$lc" | grep -Eq '\binfisical[[:space:]]+run\b'; then
    block "'infisical' commands other than 'infisical run' expose secret values. Use: infisical run -- <cmd>"
  fi
fi

# --- infisical run piped to env dumper ---
if printf '%s' "$lc" | grep -Eq '\binfisical[[:space:]]+run\b.*--([[:space:]]|[[:space:]]*[^-]*[[:space:]])(env|printenv|export)\b'; then
  block "Dumping the environment under 'infisical run' exposes secret values."
fi

# --- bare env / printenv ---
if printf '%s' "$lc" | grep -Eq '(^|[;&|`][[:space:]]*)env([[:space:]]*$|[[:space:]]*[;&|])'; then
  block "Bare 'env' lists the whole environment, which can include secrets."
fi
if printf '%s' "$lc" | grep -Eq '\bprintenv\b'; then
  block "'printenv' can print secret values."
fi

# --- reading dotenv / credential files ---
if printf '%s' "$lc" | grep -Eq '(cat|head|tail|less|more|bat|xxd|od|awk|sed|dd)\b[^;&|]*\.(env[^.]|env$|secret|credential)'; then
  block "Reading .env/secret files can expose secret values."
fi

# --- vercel env pull (writes secrets to disk) ---
if printf '%s' "$lc" | grep -Eq '\bvercel[[:space:]]+env[[:space:]]+pull\b'; then
  block "'vercel env pull' writes secret values to a file on disk."
fi

# --- pg_dump / pg_restore / psql with connection strings ---
if printf '%s' "$lc" | grep -Eq '\b(pg_dump|pg_restore|psql)\b.*(postgresql://|postgres://|--dbname=)'; then
  block "Database commands with inline connection strings can expose credentials."
fi

# --- Python scripts reading secret files ---
if printf '%s' "$lc" | grep -Eq "python3?[[:space:]].*(open\(['\"].*\.(env|secret|credential)['\"]|read\(.*\.env)"; then
  block "Python scripts reading .env/secret files can expose credentials."
fi

# --- Commands that list users or system accounts (PII exposure risk) ---
if printf '%s' "$lc" | grep -Eq '^(dscl|id|who|w|last|users|finger)\b'; then
  warn "Listing system users (dscl/id/who/w/last/users/finger) can expose names."
fi

exit 0
