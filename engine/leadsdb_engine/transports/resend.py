"""ResendTransport — Resend adapter for live testing.

Resend is one concrete adapter behind the generic ``EmailTransport`` interface,
explicitly NOT the default transport. It exists so the maintainer can test the
outreach cycle end-to-end with real sends to their own Resend account, and so
it serves as the reference implementation for writing further adapters.

No third-party delivery SDK is imported — this is a plain ``httpx`` POST to
``https://api.resend.com/emails``, matching the rest of the engine.

PII guard: never logs the recipient address or full body at info level.
"""

from __future__ import annotations

import logging

import httpx

from leadsdb_engine.transports.base import TransportError, TransportResult

logger = logging.getLogger(__name__)

RESEND_ENDPOINT = "https://api.resend.com/emails"
REQUEST_TIMEOUT_SECONDS = 60


class ResendTransport:
    """Sends via the Resend HTTP API. Requires a non-empty api_key + from_addr."""

    def __init__(self, *, api_key: str | None, from_addr: str | None) -> None:
        self._api_key = api_key or ""
        self._from_addr = from_addr or ""

    @property
    def name(self) -> str:
        return "resend"

    @property
    def is_dry_run(self) -> bool:
        # If the key was never set, we cannot send. The dispatcher should not
        # normally route here in that case, but we self-report so callers can
        # redirect to noop instead of failing every cycle.
        return not self._api_key

    def send(self, *, to: str, subject: str, text: str) -> TransportResult:
        if not self._api_key:
            raise TransportError(
                "ResendTransport selected but outreach_api_key is empty. Set the "
                "secret (settings table) or switch outreach_transport to 'noop'."
            )
        if not self._from_addr:
            raise TransportError(
                "ResendTransport selected but outreach_from_address is empty. Set it "
                "to a sender on a verified Resend domain."
            )

        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        payload = {
            "from": self._from_addr,
            "to": [to],
            "subject": subject,
            "text": text,
        }

        try:
            response = httpx.post(
                RESEND_ENDPOINT,
                headers=headers,
                json=payload,
                timeout=REQUEST_TIMEOUT_SECONDS,
            )
        except httpx.RequestError as exc:
            raise TransportError(f"Resend request failed: {exc}") from exc

        if not response.is_success:
            raise TransportError(
                f"Resend returned HTTP {response.status_code}: {response.text[:500]}"
            )

        body = response.json()
        return TransportResult(message_id=body.get("id"), status="sent")
