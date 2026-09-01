"""SequenceDispatcher — NATIVE outreach sequence engine for LeadsDB.

Replaces the older external-tool sketch with an in-repo processor that reuses
the CRM schema (contacts/deals/annotations from migration 005) and keeps PII
inside the masked CRM layer.  The CRM's contact_type='lead' + status fields
serve as the outreach state machine.

Design decisions
----------------
* **Sync loop, blocking sleep.**  The dispatcher is I/O-bound on a single
  HTTP POST per cycle; async would add complexity for no throughput gain here.
* **Resend for delivery.**  Mirrors the existing pattern in
  apps/keyword-report/resend_client.py: POST to https://api.resend.com/emails
  with RESEND_API_KEY.  Simple, no queuing infrastructure.
* **DRY-RUN mode.**  When RESEND_API_KEY is absent the dispatcher logs what it
  *would* send and writes outreach_logs with status='failed' — no email is
  dispatched.  Useful for staging or testing the cycle without burning quota.
* **Hard unsubscribed guard.**  No code path ever sends email to a contact
  whose status is 'unsubscribed'.  The SELECT excludes them and a runtime
  assert double-checks.
* **Multi-tenant.**  Operates on a single workspace_id set via env var.

PII guard: we never log the `to` address or the full email body at info level.
Only masked success/failure and message_id are recorded in logs.
"""

from __future__ import annotations

import json
import os
import time

from leadsdb_engine.db import connect
from leadsdb_engine.processors.base import EnrichmentProcessor
from leadsdb_engine.resend import ResendError, send_email

# ------------------------------------------------------------------
# Default outreach sequence (3 steps)
# ------------------------------------------------------------------
# Each step is a dict with "subject" and "body_template" keys.
# body_template uses {name} and {company_name} placeholders, rendered
# via str.format().  Override the whole sequence with the
# SEQUENCE_STEPS_JSON env var (a JSON array of the same shape).

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

# ------------------------------------------------------------------
# Env configuration
# ------------------------------------------------------------------

WORKSPACE_ID = os.environ.get(
    "LEADSDB_OUTREACH_WORKSPACE_ID",
    "main",
)

INTERVAL_SECONDS = int(os.environ.get("LEADSDB_OUTREACH_INTERVAL", "300"))

_sequence_json = os.environ.get("SEQUENCE_STEPS_JSON")
SEQUENCE: list[dict[str, str]] = (
    json.loads(_sequence_json) if _sequence_json else DEFAULT_SEQUENCE
)


def is_dry_run() -> bool:
    """Return True when RESEND_API_KEY is unset (DRY-RUN mode)."""
    return not os.environ.get("RESEND_API_KEY")


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


# ------------------------------------------------------------------
# Dispatcher implementation
# ------------------------------------------------------------------


class SequenceDispatcher(EnrichmentProcessor):
    """Dispatch outreach emails through a multi-step sequence.

    Each cycle:
      1. SELECT contacts that are reachable (lead, not unsubscribed, no recent
         log entry, not soft-deleted).
      2. Determine each contact's next step from past outreach_logs.
      3. Render the step's subject/body with the contact's name and company.
      4. Send via Resend (or log in DRY-RUN mode).
      5. Record the result in outreach_logs and update contact status.
    """

    def __init__(self) -> None:
        super().__init__("sequence-dispatcher")
        self._dry_run = is_dry_run()

    # ------------------------------------------------------------------
    # Per-contact dispatch
    # ------------------------------------------------------------------

    def _get_next_step(self, contact_id: int) -> int:
        """Return the next step number (1-based) for a contact.

        Counts existing non-deleted outreach_logs and adds 1.  If the result
        exceeds len(SEQUENCE) the contact's sequence is complete.
        """
        with connect() as conn, conn.cursor() as cur:
            cur.execute(CONTACT_LOG_COUNT, {"contact_id": contact_id})
            row = cur.fetchone()
            return (row["cnt"] if row else 0) + 1

    def _dispatch_one(
        self,
        contact: dict,
        step_num: int,
    ) -> None:
        """Send (or DRY-RUN log) step *step_num* of the sequence for *contact*.

        This method is intentionally long-ish so the caller loop stays flat
        and easy to reason about — one contact, one step, one SQL log write.
        """
        step = SEQUENCE[step_num - 1]
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

        if self._dry_run:
            self.logger.info(
                "DRY-RUN: would send email",
                contact_id=contact["id"],
                step=step_num,
                subject=subject,
            )
            message_id = None
            status = "failed"
        else:
            try:
                message_id = send_email(
                    to=contact["email"],
                    subject=subject,
                    text=body,
                )
                status = "sent"
                self.logger.info(
                    "email sent",
                    message_id=message_id,
                    step=step_num,
                )
            except (ResendError, RuntimeError) as exc:
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
                    "workspace_id": WORKSPACE_ID,
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
        """Run one outreach cycle: fetch, dispatch, sleep."""
        self.logger.info(
            "outreach cycle starting",
            workspace_id=WORKSPACE_ID,
            dry_run=self._dry_run,
        )

        with connect() as conn, conn.cursor() as cur:
            cur.execute(
                GET_OUTREACHABLE_CONTACTS,
                {"workspace_id": WORKSPACE_ID, "limit": 50},
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
            if next_step > len(SEQUENCE):
                self.logger.info(
                    "sequence complete, skipping",
                    contact_id=contact["id"],
                )
                continue

            self._dispatch_one(contact, next_step)

    # ------------------------------------------------------------------
    # Loop
    # ------------------------------------------------------------------

    def run(self) -> None:
        """Run the outreach loop until a shutdown signal is received."""
        self.logger.info(
            "sequence dispatcher started",
            dry_run=self._dry_run,
            interval_seconds=INTERVAL_SECONDS,
            sequence_steps=len(SEQUENCE),
        )

        while not self._shutdown_requested:
            try:
                self._cycle()
            except Exception as exc:
                self.logger.exception("outreach cycle error", error=str(exc))

            time.sleep(INTERVAL_SECONDS)


def main() -> None:
    """Entry point for the sequence dispatcher processor."""
    SequenceDispatcher().main()
