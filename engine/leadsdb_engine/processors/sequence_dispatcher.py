"""SequenceDispatcher — NATIVE outreach sequence engine for LeadsDB.

Reuses the CRM schema (contacts/deals/annotations from migration 005) and keeps
PII inside the masked CRM layer. The CRM's contact_type='lead' + status fields
serve as the outreach state machine.

Design decisions
----------------
* **Sync loop, blocking sleep.** The dispatcher is I/O-bound on a single send
  per cycle; async would add complexity for no throughput gain here.
* **Vendor-agnostic transport.** Delivery is delegated to an EmailTransport
  adapter (``transports/`` package) selected via the ``outreach_transport``
  setting row. ``noop`` is the default (log-only / DRY-RUN); the Resend
  adapter is available for live testing. No delivery vendor is baked in.
* **All config in the settings table.** Workspace, interval, from-address,
  sequence, transport, and the (encrypted) transport API key are read there
  at the start of each cycle — never from env vars, never hardcoded.
* **Hard unsubscribed guard.** No code path ever sends email to a contact
  whose status is 'unsubscribed'. The SELECT excludes them and a runtime
  assert double-checks.
* **Multi-tenant.** Operates on a single workspace_id set via the settings
  table (``outreach_workspace_id``).

PII guard: we never log the `to` address or the full email body at info level.
Only masked success/failure and message_id are recorded in logs.
"""

from __future__ import annotations

import json
import time
from typing import Any

from leadsdb_engine.db import connect, get_settings_map
from leadsdb_engine.processors.base import EnrichmentProcessor
from leadsdb_engine.transports import EmailTransport, TransportError, get_transport

# ------------------------------------------------------------------
# Default outreach sequence (3 steps)
# ------------------------------------------------------------------
# Each step is a dict with "subject" and "body_template" keys.
# body_template uses {name} and {company_name} placeholders, rendered
# via str.format(). Override the whole sequence with the
# outreach_sequence setting (a JSON array of the same shape); NULL/seeding
# leaves the built-in default in place.

DEFAULT_SEQUENCE: list[dict[str, str]] = [
    {
        "subject": "Quick question about {company_name}",
        "body_template": (
            "Hi {name},\n\n"
            "I came across {company_name} and was impressed by what you're doing. "
            "We help teams like yours get more leads from their web presence.\n\n"
            "Would you be open to a quick 5-minute chat this week?\n\n"
            "Best,\nIke"
        ),
    },
    {
        "subject": "Following up — {company_name}",
        "body_template": (
            "Hi {name},\n\n"
            "Just following up on my last note. "
            "We've helped similar companies identify high-value leads they were "
            "previously missing.\n\n"
            "Worth a quick call?\n\n"
            "Best,\nIke"
        ),
    },
    {
        "subject": "One last thought",
        "body_template": (
            "Hi {name},\n\n"
            "I know you're busy, so I'll keep this brief. "
            "If improving your lead pipeline isn't a priority right now, "
            "no worries at all — just let me know and I won't follow up again.\n\n"
            "Best,\nIke"
        ),
    },
]

DEFAULT_INTERVAL_SECONDS = 300
DEFAULT_WORKSPACE_ID = "main"

# ------------------------------------------------------------------
# SQL constants
# ------------------------------------------------------------------
# Defined locally rather than in db.py (owned by another track).

GET_OUTREACHABLE_CONTACTS = """
SELECT
    c.id,
    c.email,
    c.name,
    c.company_id,
    co.name AS company_name,
    c.status
FROM contacts c
LEFT JOIN companies co ON co.id = c.company_id
WHERE c.workspace_id = %(workspace_id)s
  AND c.contact_type = 'lead'
  AND c.status IN ('new', 'contacted')
  AND c.deleted_at IS NULL
  AND NOT EXISTS (
      SELECT 1
      FROM outreach_logs ol
      WHERE ol.contact_id = c.id
        AND ol.deleted_at IS NULL
        AND ol.sent_at > NOW() - INTERVAL '3 days'
  )
ORDER BY c.last_contacted_at NULLS FIRST, c.id
LIMIT %(limit)s
"""

INSERT_OUTREACH_LOG = """
INSERT INTO outreach_logs
    (workspace_id, contact_id, step_sent, message_id, status)
VALUES
    (%(workspace_id)s, %(contact_id)s, %(step_sent)s, %(message_id)s, %(status)s)
RETURNING id
"""

UPDATE_CONTACT_CONTACTED = """
UPDATE contacts
SET status = 'contacted',
    last_contacted_at = NOW(),
    updated_at = NOW()
WHERE id = %(contact_id)s
  AND deleted_at IS NULL
  AND status != 'unsubscribed'
"""

CONTACT_LOG_COUNT = """
SELECT COUNT(*) AS cnt
FROM outreach_logs
WHERE contact_id = %(contact_id)s
  AND deleted_at IS NULL
"""


def is_dispatchable(status: str, contact_type: str) -> bool:
    """Pure-function guard: should this contact receive outreach?

    The hard unsubscribed guard — no code path sends email to a contact whose
    status is 'unsubscribed'.
    """
    if status == "unsubscribed":
        return False
    return contact_type == "lead"


def _parse_sequence(raw: str | None) -> list[dict[str, str]]:
    """Parse the outreach_sequence setting (JSON array) or fall back to default."""
    if not raw:
        return DEFAULT_SEQUENCE
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return DEFAULT_SEQUENCE
    if not isinstance(parsed, list) or not parsed:
        return DEFAULT_SEQUENCE
    cleaned = [
        s for s in parsed
        if isinstance(s, dict) and "subject" in s and "body_template" in s
    ]
    return cleaned or DEFAULT_SEQUENCE


class SequenceDispatcher(EnrichmentProcessor):
    """Dispatch outreach emails through a multi-step, vendor-agnostic sequence.

    Each cycle:
      1. Load outreach config from the settings table (workspace, interval,
         from-address, sequence, transport name + encrypted api key).
      2. SELECT contacts that are reachable (lead, not unsubscribed, no recent
         log entry, not soft-deleted).
      3. Determine each contact's next step from past outreach_logs.
      4. Render the step's subject/body with the contact's name and company.
      5. Send via the selected transport (noop logs only).
      6. Record the result in outreach_logs and update contact status.
    """

    # ------------------------------------------------------------------
    # Configuration
    # ------------------------------------------------------------------

    @staticmethod
    def _load_config() -> dict[str, Any]:
        """Read the `outreach` settings category, falling back to code defaults."""
        cfg = get_settings_map("outreach")

        def typed(k, col, default):
            return (cfg.get(k) or {}).get(col) or default

        transport_name = (cfg.get("outreach_transport") or {}).get("text_value") or "noop"
        api_key_row = cfg.get("outreach_api_key") or {}
        secret = api_key_row.get("secret_value")  # decrypted plaintext or None

        return {
            "workspace_id": (cfg.get("outreach_workspace_id") or {}).get("text_value")
            or DEFAULT_WORKSPACE_ID,
            "interval": int(typed("outreach_interval", "int_value", DEFAULT_INTERVAL_SECONDS)),
            "sequence": _parse_sequence((cfg.get("outreach_sequence") or {}).get("text_value")),
            "transport": transport_name,
            "api_key": secret,
            "from_addr": (cfg.get("outreach_from_address") or {}).get("text_value") or "",
        }

    def _build_transport(self, config: dict[str, Any]) -> EmailTransport:
        """Instantiate the transport named in config, with resolved creds."""
        return get_transport(
            config["transport"],
            api_key=config.get("api_key"),
            from_addr=config.get("from_addr"),
        )

    # ------------------------------------------------------------------
    # Per-contact dispatch
    # ------------------------------------------------------------------

    def _get_next_step(self, contact_id: int) -> int:
        """Return the next step number (1-based) for a contact.

        Counts existing non-deleted outreach_logs and adds 1. If the result
        exceeds len(sequence) the contact's sequence is complete.
        """
        with connect() as conn, conn.cursor() as cur:
            cur.execute(CONTACT_LOG_COUNT, {"contact_id": contact_id})
            row = cur.fetchone()
            return (row["cnt"] if row else 0) + 1

    def _dispatch_one(
        self,
        contact: dict,
        step_num: int,
        sequence: list[dict[str, str]],
        transport: EmailTransport,
        workspace_id: str,
    ) -> None:
        """Send (or DRY-RUN log) step *step_num* of the sequence for *contact*."""
        step = sequence[step_num - 1]
        name = contact.get("name") or "there"
        company = contact.get("company_name") or "your team"

        subject = step["subject"].format(name=name, company_name=company)
        body = step["body_template"].format(name=name, company_name=company)

        # Double-check the hard guard (the WHERE clause should already prevent
        # this, but a runtime assert catches logic errors).
        assert contact["status"] != "unsubscribed", (
            f"Contact {contact['id']} is unsubscribed — should never reach dispatch"
        )

        message_id: str | None = None
        status: str

        if transport.is_dry_run:
            self.logger.info(
                "DRY-RUN: would send email",
                contact_id=contact["id"],
                step=step_num,
                subject=subject,
            )
            status = "dry_run"
        else:
            try:
                result = transport.send(to=contact["email"], subject=subject, text=body)
                message_id = result.message_id
                status = result.status
                self.logger.info(
                    "email sent",
                    step=step_num,
                    message_id=message_id,
                )
            except TransportError as exc:
                self.logger.warning(
                    "email send failed",
                    contact_id=contact["id"],
                    step=step_num,
                    error=str(exc),
                )
                status = "failed"

        with connect() as conn, conn.cursor() as cur:
            cur.execute(
                INSERT_OUTREACH_LOG,
                {
                    "workspace_id": workspace_id,
                    "contact_id": contact["id"],
                    "step_sent": step_num,
                    "message_id": message_id,
                    "status": status,
                },
            )
            if status == "sent":
                cur.execute(
                    UPDATE_CONTACT_CONTACTED,
                    {"contact_id": contact["id"]},
                )
            conn.commit()

    # ------------------------------------------------------------------
    # Cycle management
    # ------------------------------------------------------------------

    def _cycle(self) -> None:
        """Run one outreach cycle: load config, fetch, dispatch, sleep."""
        config = self._load_config()
        transport = self._build_transport(config)
        workspace_id = config["workspace_id"]

        self.logger.info(
            "outreach cycle starting",
            workspace_id=workspace_id,
            transport=transport.name,
            dry_run=transport.is_dry_run,
        )

        with connect() as conn, conn.cursor() as cur:
            cur.execute(
                GET_OUTREACHABLE_CONTACTS,
                {"workspace_id": workspace_id, "limit": 50},
            )
            contacts = cur.fetchall()

        if not contacts:
            self.logger.info("no contacts to email this cycle")
            return

        self.logger.info("dispatch batch", count=len(contacts))

        for contact in contacts:
            if self._shutdown_requested:
                break

            next_step = self._get_next_step(contact["id"])
            if next_step > len(config["sequence"]):
                self.logger.info(
                    "sequence complete, skipping",
                    contact_id=contact["id"],
                )
                continue

            self._dispatch_one(contact, next_step, config["sequence"], transport, workspace_id)

    # ------------------------------------------------------------------
    # Loop
    # ------------------------------------------------------------------

    def run(self) -> None:
        """Run the outreach loop until a shutdown signal is received."""
        config = self._load_config()
        self.logger.info(
            "sequence dispatcher started",
            interval_seconds=config["interval"],
            sequence_steps=len(config["sequence"]),
        )

        while not self._shutdown_requested:
            try:
                self._cycle()
            except Exception as exc:
                self.logger.exception("outreach cycle error", error=str(exc))

            time.sleep(config["interval"])


def main() -> None:
    """Entry point for the sequence dispatcher processor."""
    SequenceDispatcher().main()
