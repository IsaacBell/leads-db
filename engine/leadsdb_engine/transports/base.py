"""Base interface for outreach email transports.

A transport is a thin delivery adapter: given a rendered email (to/subject/
body) and credentials sourced from the encrypted settings table by the caller,
it performs the actual send and returns a transport-local message id.

Transports hold no global state and read no environment variables. They are
constructed per-cycle by the dispatcher and discarded. This keeps the delivery
vendor swappable (BYOK-style: ``noop`` by default, Resend for live testing,
future adapters for whatever the maintainer chooses) and keeps secrets out of
the engine core.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


class TransportError(RuntimeError):
    """Raised when a transport cannot send (auth failure, upstream error, …)."""


@dataclass(frozen=True)
class TransportResult:
    """Outcome of a single send attempt."""

    message_id: str | None  # provider-local id when available; None on DRY-RUN / failure
    status: str            # "sent" | "failed" | "dry_run"


class EmailTransport(Protocol):
    """Minimal delivery contract every outreach transport implements."""

    @property
    def name(self) -> str: ...

    @property
    def is_dry_run(self) -> bool: ...

    def send(self, *, to: str, subject: str, text: str) -> TransportResult: ...
