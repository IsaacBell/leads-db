"""NoopTransport — log-only default. Never sends.

Used when no transport has been chosen, when ``outreach_transport`` is unset,
or whenever the maintainer wants DRY-RUN behavior. Useful as the safe default
for an open-source project: a fresh deploy cannot accidentally send cold email
to anyone — every step logs what it would have done and records a ``dry_run``
result in outreach_logs.
"""

from __future__ import annotations

import logging

from leadsdb_engine.transports.base import TransportResult

logger = logging.getLogger(__name__)


class NoopTransport:
    """Logs the email it would send; returns a dry_run result."""

    def __init__(self, *, api_key: str | None, from_addr: str | None) -> None:
        # api_key / from_addr are accepted for interface uniformity and ignored.
        self._api_key = api_key
        self._from_addr = from_addr

    @property
    def name(self) -> str:
        return "noop"

    @property
    def is_dry_run(self) -> bool:
        return True

    def send(self, *, to: str, subject: str, text: str) -> TransportResult:  # noqa: ARG002
        logger.info(
            "NOOP transport: would send email",
            extra={"to_masked": _mask(to), "subject": subject},
        )
        return TransportResult(message_id=None, status="dry_run")


def _mask(addr: str) -> str:
    """Mask a recipient address for logging (PII guard)."""
    if not addr or "@" not in addr:
        return "[empty]"
    name, _, domain = addr.partition("@")
    return f"{name[:1]}***@{domain}"
