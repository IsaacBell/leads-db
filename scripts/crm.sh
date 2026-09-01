#!/usr/bin/env bash
# CRM contact management for leads-db.
# PII is always masked by default. Use --reveal for full output (with care).
#
# Usage:  ./scripts/crm.sh <command> [args]
#
# Commands:
#   company add <name>  Add a company
#   add <email>         Add or update a contact (accepts all PII fields)
#   get <id|email>      Look up a contact (PII masked, use --reveal to show)
#   list                Search contacts (PII masked, use --reveal to show)
#   status <id> <val>   Update contact status
#   delete <id>         Soft-delete a contact
#   social add <cid>    Add a social link to a contact
#   social list <cid>   List social links for a contact
set -euo pipefail

cd "$(dirname "$0")/.."
CMD="${1:-help}"
shift || true

case "$CMD" in
  company)
    SUB="${1:-}"; shift || true
    if [ "$SUB" = "add" ]; then
      ARGS=""
      while [ $# -gt 0 ]; do
        case "$1" in
          --name) ARGS="$ARGS --name '$2'"; shift 2 ;;
          --domain) ARGS="$ARGS --domain '$2'"; shift 2 ;;
          --description) ARGS="$ARGS --description '$2'"; shift 2 ;;
          --industry) ARGS="$ARGS --industry '$2'"; shift 2 ;;
          *) shift ;;
        esac
      done
      eval "uv run -m leadsdb_engine.crm company add $ARGS"
    else
      echo "Usage: crm.sh company add --name <name> [--domain] [--industry]"
    fi
    ;;

  add)
    EMAIL="${1:-}"
    shift || true
    [ -z "$EMAIL" ] && { echo "Usage: crm.sh add <email> [--name] [--phone] [--city] [--country] ..."; exit 1; }

    ARGS="--email '$EMAIL'"
    while [ $# -gt 0 ]; do
      case "$1" in
        --name) ARGS="$ARGS --name '$2'"; shift 2 ;;
        --company-id) ARGS="$ARGS --company-id '$2'"; shift 2 ;;
        --role) ARGS="$ARGS --role '$2'"; shift 2 ;;
        --phone) ARGS="$ARGS --phone '$2'"; shift 2 ;;
        --city) ARGS="$ARGS --city '$2'"; shift 2 ;;
        --country) ARGS="$ARGS --country '$2'"; shift 2 ;;
        --source) ARGS="$ARGS --source '$2'"; shift 2 ;;
        --status) ARGS="$ARGS --status '$2'"; shift 2 ;;
        --notes) ARGS="$ARGS --notes '$2'"; shift 2 ;;
        *) shift ;;
      esac
    done

    eval "uv run -m leadsdb_engine.crm add $ARGS"
    ;;

  get)
    ID="${1:-}"
    REVEAL=""
    shift || true
    for arg in "$@"; do [ "$arg" = "--reveal" ] && REVEAL="--reveal"; done
    [ -z "$ID" ] && { echo "Usage: crm.sh get <id|email> [--reveal]"; exit 1; }
    uv run -m leadsdb_engine.crm get --id "$ID" $REVEAL
    ;;

  list)
    ARGS=""
    while [ $# -gt 0 ]; do
      case "$1" in
        --status) ARGS="$ARGS --status '$2'"; shift 2 ;;
        --q) ARGS="$ARGS --q '$2'"; shift 2 ;;
        --limit) ARGS="$ARGS --limit '$2'"; shift 2 ;;
        --offset) ARGS="$ARGS --offset '$2'"; shift 2 ;;
        --reveal) ARGS="$ARGS --reveal"; shift ;;
        *) shift ;;
      esac
    done
    eval "uv run -m leadsdb_engine.crm list $ARGS"
    ;;

  status)
    ID="${1:-}"; NEW_STATUS="${2:-}"
    [ -z "$ID" ] && { echo "Usage: crm.sh status <id> <new_status> [--contacted]"; exit 1; }
    [ -z "$NEW_STATUS" ] && { echo "Usage: crm.sh status <id> <new_status> [--contacted]"; exit 1; }
    shift 2
    CONTACTED=""
    for arg in "$@"; do [ "$arg" = "--contacted" ] && CONTACTED="--contacted"; done
    uv run -m leadsdb_engine.crm status --id "$ID" --status "$NEW_STATUS" $CONTACTED
    ;;

  contact-type)
    ID="${1:-}"; TYPE="${2:-}"
    [ -z "$ID" ] || [ -z "$TYPE" ] && { echo "Usage: crm.sh contact-type <id> <lead|contact>"; exit 1; }
    uv run -m leadsdb_engine.crm contact-type --id "$ID" --type "$TYPE"
    ;;

  delete)
    ID="${1:-}"
    [ -z "$ID" ] && { echo "Usage: crm.sh delete <id>"; exit 1; }
    uv run -m leadsdb_engine.crm delete --id "$ID"
    ;;

  deal)
    SUB="${1:-}"; shift || true
    [ -z "$SUB" ] && { echo "Usage: crm.sh deal <add|get|list|stage|delete> [flags]"; exit 1; }
    ARGS=""
    while [ $# -gt 0 ]; do ARGS="$ARGS '$1'"; shift; done
    eval "uv run -m leadsdb_engine.crm deal $SUB $ARGS"
    ;;

  annotation)
    SUB="${1:-}"; shift || true
    [ -z "$SUB" ] && { echo "Usage: crm.sh annotation <add|list|delete> [flags]"; exit 1; }
    ARGS=""
    while [ $# -gt 0 ]; do ARGS="$ARGS '$1'"; shift; done
    eval "uv run -m leadsdb_engine.crm annotation $SUB $ARGS"
    ;;

  social)
    SUB="${1:-}"; shift || true
    case "$SUB" in
      add)
        CID="${1:-}"; shift || true
        [ -z "$CID" ] && { echo "Usage: crm.sh social add <contact-id> --platform <p> --url <u>"; exit 1; }
        ARGS="--contact-id $CID"
        while [ $# -gt 0 ]; do
          case "$1" in
            --platform) ARGS="$ARGS --platform '$2'"; shift 2 ;;
            --url) ARGS="$ARGS --url '$2'"; shift 2 ;;
            --label) ARGS="$ARGS --label '$2'"; shift 2 ;;
            *) shift ;;
          esac
        done
        eval "uv run -m leadsdb_engine.crm social add $ARGS"
        ;;
      list)
        CID="${1:-}"
        [ -z "$CID" ] && { echo "Usage: crm.sh social list <contact-id>"; exit 1; }
        uv run -m leadsdb_engine.crm social list --contact-id "$CID"
        ;;
      delete)
        ID="${1:-}"
        [ -z "$ID" ] && { echo "Usage: crm.sh social delete <id>"; exit 1; }
        uv run -m leadsdb_engine.crm social delete --id "$ID"
        ;;
      *)
        echo "Usage: crm.sh social <add|list|delete> ..."
        ;;
    esac
    ;;

  help|--help|-h)
    echo "Usage: crm.sh <command>"
    echo ""
    echo "Commands:"
    echo "  company add            Add a company"
    echo "  add <email>           Add or update a contact (accepts PII)"
    echo "  get <id|email>        Look up a contact (masked; --reveal for full)"
    echo "  list                  Search contacts (masked; --reveal for full)"
    echo "  status <id> <val>     Update contact status"
    echo "  contact-type <id> <t> Flip a contact between lead|contact"
    echo "  delete <id>           Soft-delete a contact"
    echo "  social add            Add a social link"
    echo "  social list           List social links"
    echo "  social delete         Soft-delete a social link"
    echo "  deal <add|get|list|stage|delete>   Manage pipeline deals"
    echo "  annotation <add|list|delete>      Manage research annotations"
    ;;
esac
