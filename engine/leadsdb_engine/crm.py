"""CRM contact management CLI — contacts, companies, social links, deals, annotations.

Multi-tenant: every operation requires --workspace (or INFISICAL_WORKSPACE_ID env).
PII handling (Safe Harbor, HIPAA 18 identifiers):
  - Create/update: accepts full PII freely (name, email, phone, URLs)
  - Read (default):  all PII fields masked per Safe Harbor rules
  - Read (--reveal):  full unmasked output — use with care
  - List (default):   email masked, name masked
  - List (--reveal):  full unmasked output
  - Annotation on a contact target: value JSONB masked by default (may carry PII);
    --reveal returns it raw. Non-contact targets are returned intact.

Usage:
    uv run -m leadsdb_engine.crm add --email jane@ex.com --name "Jane Doe" --phone "+1-415-555-1234"
    uv run -m leadsdb_engine.crm get --id 42
    uv run -m leadsdb_engine.crm get --id 42 --reveal
    uv run -m leadsdb_engine.crm contact-type --id 42 --type contact
    uv run -m leadsdb_engine.crm social add --contact-id 42 --platform github --url https://github.com/janedoe
    uv run -m leadsdb_engine.crm deal add --contact-id 42 --title "Q3 retainer" --value 12000 --stage qualification
    uv run -m leadsdb_engine.crm deal stage --id 7 --stage proposal
    uv run -m leadsdb_engine.crm annotation add --target-type contact --target-id 42 --source exa --key linkedin --value '{"headline":"CTO"}'
    uv run -m leadsdb_engine.crm annotation list --target-type contact --target-id 42
"""

import argparse
import json
import os
import sys

from leadsdb_engine.logging import Log
Log.error("test")

from psycopg.types.json import Jsonb

from leadsdb_engine.db import (
    DELETE_ANNOTATION,
    DELETE_CONTACT,
    DELETE_DEAL,
    DELETE_SOCIAL_LINK,
    GET_ANNOTATIONS,
    GET_CONTACT,
    GET_CONTACT_BY_EMAIL,
    GET_DEAL,
    GET_SOCIAL_LINKS,
    INSERT_ANNOTATION,
    INSERT_COMPANY,
    INSERT_CONTACT,
    INSERT_DEAL,
    INSERT_SOCIAL_LINK,
    SEARCH_CONTACTS,
    SEARCH_DEALS,
    UPDATE_CONTACT_STATUS,
    UPDATE_CONTACT_TYPE,
    UPDATE_DEAL_STAGE,
    Annotation,
    Contact,
    Deal,
    SocialLink,
    connect,
)
from leadsdb_engine.pii import mask_annotation_row, mask_contact_row

ALL_PLATFORMS = [
    "behance", "bluesky", "discord", "dribbble", "facebook",
    "github", "instagram", "linkedin", "medium", "pinterest",
    "snapchat", "threads", "tiktok", "twitch", "x",
    "website", "portfolio", "youtube", "other",
]
ALL_CONTACT_TYPES = ["lead", "contact"]
ALL_SOURCES = ["api", "web_subscribe", "manual", "import"]
ALL_STATUSES = ["new", "contacted", "qualified", "unsubscribed", "customer"]
ALL_STAGES = [
    "discovery", "qualification", "proposal",
    "negotiation", "closed_won", "closed_lost",
]
ALL_TARGET_TYPES = ["contact", "company", "deal", "domain_event"]


def _resolve_workspace(args: argparse.Namespace) -> str:
    """Return workspace from --workspace flag or env var."""
    wid = args.workspace or os.environ.get("INFISICAL_WORKSPACE_ID")
    if not wid:
        print("ERROR: --workspace required or set INFISICAL_WORKSPACE_ID", file=sys.stderr)
        sys.exit(1)
    return wid


def _print_contact(row: dict, reveal: bool = False) -> None:
    display = row if reveal else mask_contact_row(row)
    for key, val in display.items():
        if val is not None:
            print(f"{key}: {val}")
    print()


# ── Company ─────────────────────────────────────────────────────────────

def cmd_company_add(args: argparse.Namespace) -> None:
    wid = _resolve_workspace(args)
    from leadsdb_engine.db import Company
    company = Company(
        workspace_id=wid,
        name=args.name,
        domain=args.domain,
        description=args.description,
        industry=args.industry,
    )
    with connect() as conn, conn.cursor() as cur:
        cur.execute(INSERT_COMPANY, company.model_dump())
        row = cur.fetchone()
    print(f"Company added: id={row['id']}, name={company.name}")


# ── Contact ─────────────────────────────────────────────────────────────

def cmd_add(args: argparse.Namespace) -> None:
    wid = _resolve_workspace(args)
    contact = Contact(
        workspace_id=wid,
        email=args.email,
        company_id=args.company_id,
        name=args.name,
        role=args.role,
        phone=args.phone,
        city=args.city,
        country=args.country,
        contact_type=args.contact_type,
        source=args.source or "api",
        status=args.status or "new",
        notes=args.notes,
    )
    with connect() as conn, conn.cursor() as cur:
        cur.execute(INSERT_CONTACT, contact.model_dump())
        row = cur.fetchone()
    print(f"Contact added: id={row['id']}")
    _print_contact(contact.model_dump() | {"id": row["id"]}, reveal=False)


def cmd_get(args: argparse.Namespace) -> None:
    with connect() as conn, conn.cursor() as cur:
        try:
            int(args.id)
            cur.execute(GET_CONTACT, {"id": int(args.id)})
        except ValueError:
            wid = _resolve_workspace(args)
            cur.execute(GET_CONTACT_BY_EMAIL, {"email": args.id, "workspace_id": wid})
        row = cur.fetchone()

    if not row:
        print(f"Contact not found: {args.id}", file=sys.stderr)
        sys.exit(1)

    _print_contact(row, reveal=args.reveal)


def cmd_list(args: argparse.Namespace) -> None:
    wid = _resolve_workspace(args)
    q = f"%{args.q}%" if args.q else None
    params = {
        "workspace_id": wid,
        "status": args.status,
        "q": q,
        "limit": args.limit or 50,
        "offset": args.offset or 0,
    }
    with connect() as conn, conn.cursor() as cur:
        cur.execute(SEARCH_CONTACTS, params)
        rows = cur.fetchall()

    if not rows:
        print("No contacts found.")
        return

    hdr = f"{'ID':<6} {'Email':<35} {'Name':<22} {'Type':<9} {'Company':<25} {'Role':<20} {'Status':<15}"
    print(hdr)
    print("-" * len(hdr))

    for row in rows:
        d = row if args.reveal else mask_contact_row(row)
        print(f"{d['id']:<6} {(d.get('email') or ''):<35} {(d.get('name') or ''):<22} "
              f"{(d.get('contact_type') or ''):<9} {(d.get('company_name') or ''):<25} "
              f"{(d.get('role') or ''):<20} {d['status']:<15}")


def cmd_status(args: argparse.Namespace) -> None:
    params = {"id": args.id, "status": args.status, "contacted": args.contacted}
    with connect() as conn, conn.cursor() as cur:
        cur.execute(UPDATE_CONTACT_STATUS, params)
        row = cur.fetchone()
    if not row:
        print(f"Contact not found: {args.id}", file=sys.stderr)
        sys.exit(1)
    print(f"Contact {row['id']}: status -> {row['status']}")


def cmd_contact_type(args: argparse.Namespace) -> None:
    params = {"id": args.id, "contact_type": args.contact_type}
    with connect() as conn, conn.cursor() as cur:
        cur.execute(UPDATE_CONTACT_TYPE, params)
        row = cur.fetchone()
    if not row:
        print(f"Contact not found: {args.id}", file=sys.stderr)
        sys.exit(1)
    print(f"Contact {row['id']}: contact_type -> {row['contact_type']}")


def cmd_delete(args: argparse.Namespace) -> None:
    with connect() as conn, conn.cursor() as cur:
        cur.execute(DELETE_CONTACT, {"id": args.id})
        row = cur.fetchone()
    if not row:
        print(f"Contact not found: {args.id}", file=sys.stderr)
        sys.exit(1)
    print(f"Contact {row['id']}: soft-deleted")


# ── Social Links ────────────────────────────────────────────────────────

def cmd_social_add(args: argparse.Namespace) -> None:
    link = SocialLink(contact_id=args.contact_id, platform=args.platform, url=args.url, label=args.label)
    with connect() as conn, conn.cursor() as cur:
        cur.execute(INSERT_SOCIAL_LINK, link.model_dump())
        row = cur.fetchone()
    print(f"Social link added: id={row['id']}, {args.platform} -> {args.url}")


def cmd_social_list(args: argparse.Namespace) -> None:
    with connect() as conn, conn.cursor() as cur:
        cur.execute(GET_SOCIAL_LINKS, {"contact_id": args.contact_id})
        rows = cur.fetchall()
    if not rows:
        print("No social links for this contact.")
        return
    print(f"{'ID':<6} {'Platform':<15} {'URL':<50} {'Label':<20}")
    print("-" * 91)
    for row in rows:
        print(f"{row['id']:<6} {row['platform']:<15} {row['url']:<50} {(row['label'] or ''):<20}")


def cmd_social_delete(args: argparse.Namespace) -> None:
    with connect() as conn, conn.cursor() as cur:
        cur.execute(DELETE_SOCIAL_LINK, {"id": args.id})
        row = cur.fetchone()
    if not row:
        print(f"Social link not found: {args.id}", file=sys.stderr)
        sys.exit(1)
    print(f"Social link {row['id']}: soft-deleted")


# ── Deals ───────────────────────────────────────────────────────────────

def cmd_deal_add(args: argparse.Namespace) -> None:
    wid = _resolve_workspace(args)
    deal = Deal(
        workspace_id=wid,
        contact_id=args.contact_id,
        company_id=args.company_id,
        title=args.title,
        description=args.description,
        value=args.value,
        currency=args.currency,
        stage=args.stage,
        probability=args.probability,
        expected_close=args.expected_close,
        source=args.source,
        source_url=args.source_url,
    )
    with connect() as conn, conn.cursor() as cur:
        cur.execute(INSERT_DEAL, deal.model_dump())
        row = cur.fetchone()
    print(f"Deal added: id={row['id']}, stage={deal.stage}, title={deal.title}")


def cmd_deal_get(args: argparse.Namespace) -> None:
    with connect() as conn, conn.cursor() as cur:
        cur.execute(GET_DEAL, {"id": args.id})
        row = cur.fetchone()
    if not row:
        print(f"Deal not found: {args.id}", file=sys.stderr)
        sys.exit(1)
    # Contact email is PII — mask unless --reveal.
    email = row.get("contact_email")
    shown_email = email if args.reveal else (f"{email[0]}@***" if email else None)
    print(f"id: {row['id']}")
    print(f"title: {row['title']}")
    print(f"stage: {row['stage']}")
    print(f"value: {row['value']} {row['currency']}" if row.get("value") is not None else "value: (none)")
    print(f"probability: {row['probability']}" if row.get("probability") is not None else "probability: (none)")
    print(f"expected_close: {row.get('expected_close')}")
    print(f"contact_id: {row.get('contact_id')}  contact_email: {shown_email}")
    print(f"company_id: {row.get('company_id')}  company_name: {row.get('company_name')}")
    if row.get("description"):
        print(f"description: {row['description']}")
    print(f"source: {row.get('source')}  source_url: {row.get('source_url')}")


def cmd_deal_list(args: argparse.Namespace) -> None:
    wid = _resolve_workspace(args)
    contact_id = args.contact_id if args.contact_id is not None else None
    params = {
        "workspace_id": wid,
        "stage": args.stage,
        "contact_id": contact_id,
        "limit": args.limit or 50,
        "offset": args.offset or 0,
    }
    with connect() as conn, conn.cursor() as cur:
        cur.execute(SEARCH_DEALS, params)
        rows = cur.fetchall()
    if not rows:
        print("No deals found.")
        return
    hdr = f"{'ID':<6} {'Title':<40} {'Stage':<14} {'Value':<12} {'Company':<25} {'Expected close':<26}"
    print(hdr)
    print("-" * len(hdr))
    for row in rows:
        val = f"{row['value']} {row['currency']}" if row.get("value") is not None else "-"
        print(f"{row['id']:<6} {(row.get('title') or '')[:38]:<40} {row['stage']:<14} {val:<12} "
              f"{(row.get('company_name') or ''):<25} {(row.get('expected_close') or '-'):<26}")


def cmd_deal_stage(args: argparse.Namespace) -> None:
    with connect() as conn, conn.cursor() as cur:
        cur.execute(UPDATE_DEAL_STAGE, {"id": args.id, "stage": args.stage})
        row = cur.fetchone()
    if not row:
        print(f"Deal not found: {args.id}", file=sys.stderr)
        sys.exit(1)
    print(f"Deal {row['id']}: stage -> {row['stage']}")


def cmd_deal_delete(args: argparse.Namespace) -> None:
    with connect() as conn, conn.cursor() as cur:
        cur.execute(DELETE_DEAL, {"id": args.id})
        row = cur.fetchone()
    if not row:
        print(f"Deal not found: {args.id}", file=sys.stderr)
        sys.exit(1)
    print(f"Deal {row['id']}: soft-deleted")


# ── Annotations ─────────────────────────────────────────────────────────

def cmd_annotation_add(args: argparse.Namespace) -> None:
    wid = _resolve_workspace(args)
    value_obj = None
    if args.value is not None:
        try:
            value_obj = json.loads(args.value)
        except json.JSONDecodeError as exc:
            print(f"ERROR: --value must be valid JSON: {exc}", file=sys.stderr)
            sys.exit(1)
    ann = Annotation(
        workspace_id=wid,
        target_type=args.target_type,
        target_id=args.target_id,
        source=args.source,
        key=args.key,
        value=value_obj,
        confidence=args.confidence,
        author_id=args.author_id,
    )
    params = ann.model_dump()
    # psycopg needs a typed adapter for JSONB; a bare dict adapts to json, but
    # use Jsonb explicitly so the column type matches without an implicit cast.
    params["value"] = Jsonb(value_obj) if value_obj is not None else None
    with connect() as conn, conn.cursor() as cur:
        cur.execute(INSERT_ANNOTATION, params)
        row = cur.fetchone()
    print(f"Annotation added: id={row['id']}, target={args.target_type}:{args.target_id}, key={args.key}")


def cmd_annotation_list(args: argparse.Namespace) -> None:
    wid = _resolve_workspace(args)
    target_id = args.target_id if args.target_id is not None else None
    params = {
        "workspace_id": wid,
        "target_type": args.target_type,
        "target_id": target_id,
        "limit": args.limit or 50,
        "offset": args.offset or 0,
    }
    with connect() as conn, conn.cursor() as cur:
        cur.execute(GET_ANNOTATIONS, params)
        rows = cur.fetchall()
    if not rows:
        print("No annotations found.")
        return
    for row in rows:
        d = mask_annotation_row(row, reveal=args.reveal)
        val = d.get("value")
        val_str = json.dumps(val) if not isinstance(val, str) else val
        print(f"id={d['id']} [{d['target_type']}:{d['target_id']}] "
              f"source={d.get('source')} key={d['key']} confidence={d.get('confidence')}")
        print(f"  value: {val_str}")
        print(f"  created_at={d.get('created_at')}")


def cmd_annotation_delete(args: argparse.Namespace) -> None:
    with connect() as conn, conn.cursor() as cur:
        cur.execute(DELETE_ANNOTATION, {"id": args.id})
        row = cur.fetchone()
    if not row:
        print(f"Annotation not found: {args.id}", file=sys.stderr)
        sys.exit(1)
    print(f"Annotation {row['id']}: soft-deleted")


# ── Main ────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        prog="crm",
        description="CRM contact management (Safe Harbor PII masking)",
    )
    parser.add_argument("--workspace", help="Workspace ID (or set INFISICAL_WORKSPACE_ID)")
    sub = parser.add_subparsers(dest="command", required=True)

    # company add
    p_co = sub.add_parser("company", help="Manage companies")
    co_sub = p_co.add_subparsers(dest="subcommand", required=True)
    p_co_add = co_sub.add_parser("add", help="Add a company")
    p_co_add.add_argument("--name", required=True)
    p_co_add.add_argument("--domain")
    p_co_add.add_argument("--description")
    p_co_add.add_argument("--industry")
    p_co_add.set_defaults(func=cmd_company_add)

    # add
    p_add = sub.add_parser("add", help="Add or update a contact (accepts full PII)")
    p_add.add_argument("--email", required=True)
    p_add.add_argument("--name")
    p_add.add_argument("--company-id", type=int)
    p_add.add_argument("--role")
    p_add.add_argument("--phone")
    p_add.add_argument("--city")
    p_add.add_argument("--country")
    p_add.add_argument("--contact-type", choices=ALL_CONTACT_TYPES, default="lead")
    p_add.add_argument("--source", choices=ALL_SOURCES, default="api")
    p_add.add_argument("--status", choices=ALL_STATUSES, default="new")
    p_add.add_argument("--notes")
    p_add.set_defaults(func=cmd_add)

    # get
    p_get = sub.add_parser("get", help="Look up a contact by ID or email (PII masked)")
    p_get.add_argument("--id", required=True)
    p_get.add_argument("--reveal", action="store_true")
    p_get.set_defaults(func=cmd_get)

    # list
    p_list = sub.add_parser("list", help="Search contacts (PII masked)")
    p_list.add_argument("--status", choices=ALL_STATUSES)
    p_list.add_argument("--q")
    p_list.add_argument("--limit", type=int, default=50)
    p_list.add_argument("--offset", type=int, default=0)
    p_list.add_argument("--reveal", action="store_true")
    p_list.set_defaults(func=cmd_list)

    # status
    p_st = sub.add_parser("status", help="Update contact status")
    p_st.add_argument("--id", required=True, type=int)
    p_st.add_argument("--status", required=True, choices=ALL_STATUSES)
    p_st.add_argument("--contacted", action="store_true")
    p_st.set_defaults(func=cmd_status)

    # contact-type
    p_ct = sub.add_parser("contact-type", help="Flip a contact between lead and contact")
    p_ct.add_argument("--id", required=True, type=int)
    p_ct.add_argument("--type", required=True, choices=ALL_CONTACT_TYPES, dest="contact_type")
    p_ct.set_defaults(func=cmd_contact_type)

    # delete
    p_del = sub.add_parser("delete", help="Soft-delete a contact")
    p_del.add_argument("--id", required=True, type=int)
    p_del.set_defaults(func=cmd_delete)

    # social
    p_soc = sub.add_parser("social", help="Manage social links for a contact")
    soc_sub = p_soc.add_subparsers(dest="subcommand", required=True)

    p_sa = soc_sub.add_parser("add", help="Add or update a social link")
    p_sa.add_argument("--contact-id", required=True, type=int)
    p_sa.add_argument("--platform", required=True, choices=ALL_PLATFORMS)
    p_sa.add_argument("--url", required=True)
    p_sa.add_argument("--label")
    p_sa.set_defaults(func=cmd_social_add)

    p_sl = soc_sub.add_parser("list", help="List social links for a contact")
    p_sl.add_argument("--contact-id", required=True, type=int)
    p_sl.set_defaults(func=cmd_social_list)

    p_sd = soc_sub.add_parser("delete", help="Soft-delete a social link")
    p_sd.add_argument("--id", required=True, type=int)
    p_sd.set_defaults(func=cmd_social_delete)

    # deal
    p_deal = sub.add_parser("deal", help="Manage sales pipeline deals")
    deal_sub = p_deal.add_subparsers(dest="subcommand", required=True)

    p_da = deal_sub.add_parser("add", help="Create a deal")
    p_da.add_argument("--contact-id", type=int)
    p_da.add_argument("--company-id", type=int)
    p_da.add_argument("--title", required=True)
    p_da.add_argument("--description")
    p_da.add_argument("--value", type=float)
    p_da.add_argument("--currency", default="USD")
    p_da.add_argument("--stage", choices=ALL_STAGES, default="discovery")
    p_da.add_argument("--probability", type=int)
    p_da.add_argument("--expected-close", dest="expected_close")
    p_da.add_argument("--source")
    p_da.add_argument("--source-url", dest="source_url")
    p_da.set_defaults(func=cmd_deal_add)

    p_dg = deal_sub.add_parser("get", help="Show a deal (contact email masked; --reveal to show)")
    p_dg.add_argument("--id", required=True, type=int)
    p_dg.add_argument("--reveal", action="store_true")
    p_dg.set_defaults(func=cmd_deal_get)

    p_dl = deal_sub.add_parser("list", help="List deals (no PII; optionally filter by stage/contact)")
    p_dl.add_argument("--stage", choices=ALL_STAGES)
    p_dl.add_argument("--contact-id", type=int)
    p_dl.add_argument("--limit", type=int, default=50)
    p_dl.add_argument("--offset", type=int, default=0)
    p_dl.set_defaults(func=cmd_deal_list)

    p_ds = deal_sub.add_parser("stage", help="Move a deal to a new stage")
    p_ds.add_argument("--id", required=True, type=int)
    p_ds.add_argument("--stage", required=True, choices=ALL_STAGES)
    p_ds.set_defaults(func=cmd_deal_stage)

    p_dd = deal_sub.add_parser("delete", help="Soft-delete a deal")
    p_dd.add_argument("--id", required=True, type=int)
    p_dd.set_defaults(func=cmd_deal_delete)

    # annotation
    p_ann = sub.add_parser("annotation", help="Manage research annotations")
    ann_sub = p_ann.add_subparsers(dest="subcommand", required=True)

    p_aa = ann_sub.add_parser("add", help="Add an annotation (value must be JSON)")
    p_aa.add_argument("--target-type", required=True, choices=ALL_TARGET_TYPES, dest="target_type")
    p_aa.add_argument("--target-id", required=True, type=int, dest="target_id")
    p_aa.add_argument("--source")
    p_aa.add_argument("--key", required=True)
    p_aa.add_argument("--value", help="JSON string for the annotation value")
    p_aa.add_argument("--confidence", type=float)
    p_aa.add_argument("--author-id", type=int, dest="author_id")
    p_aa.set_defaults(func=cmd_annotation_add)

    p_al = ann_sub.add_parser("list", help="List annotations (contact-target value masked; --reveal to show)")
    p_al.add_argument("--target-type", choices=ALL_TARGET_TYPES, dest="target_type")
    p_al.add_argument("--target-id", type=int, dest="target_id")
    p_al.add_argument("--limit", type=int, default=50)
    p_al.add_argument("--offset", type=int, default=0)
    p_al.add_argument("--reveal", action="store_true")
    p_al.set_defaults(func=cmd_annotation_list)

    p_adel = ann_sub.add_parser("delete", help="Soft-delete an annotation")
    p_adel.add_argument("--id", required=True, type=int)
    p_adel.set_defaults(func=cmd_annotation_delete)

    args = parser.parse_args()

    if getattr(args, "reveal", False) and not sys.stdout.isatty():
        print("⚠  WARNING: --reveal outputs unmasked PII to non-terminal.", file=sys.stderr)

    args.func(args)


if __name__ == "__main__":
    main()
