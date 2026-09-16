"""Outreach email transports — generic adapter interface.

LeadsDB does not bake any delivery vendor in. The dispatcher selects an adapter
at runtime via the `outreach_transport` setting row (default: ``noop`` — a
log-only transport used for DRY-RUN and local development).

Adding a provider:
    1. Create ``transports/<name>.py`` implementing ``EmailTransport``.
    2. Register it in this module's registry below.
    3. Set ``outreach_transport`` in the settings table to the adapter name.

The Resend adapter (``transports/resend.py``) is the reference implementation —
useful for the maintainer to test live sends with their own Resend account. It
is NOT the default, and the engine imports no third-party delivery SDK.
"""

from __future__ import annotations

from leadsdb_engine.transports.base import EmailTransport, TransportError, TransportResult
from leadsdb_engine.transports.noop import NoopTransport
from leadsdb_engine.transports.resend import ResendTransport

__all__ = [
    "EmailTransport",
    "TransportError",
    "TransportResult",
    "NoopTransport",
    "ResendTransport",
    "get_transport",
    "available_transports",
]


_REGISTRY: dict[str, type[EmailTransport]] = {
    "noop": NoopTransport,
    "resend": ResendTransport,
}


def get_transport(name: str, *, api_key: str | None, from_addr: str | None) -> EmailTransport:
    """Instantiate the transport named *name*, or raise TransportError.

    The api_key / from_addr are sourced by the caller from the encrypted
    settings table; transports never read env vars or touch secrets storage.
    """
    cls = _REGISTRY.get(name)
    if cls is None:
        raise TransportError(
            f"unknown outreach transport {name!r}. Available: {sorted(_REGISTRY)}"
        )
    return cls(api_key=api_key or "", from_addr=from_addr or "")


def available_transports() -> list[str]:
    """Return the registered transport names (for admin-panel / CLI display)."""
    return sorted(_REGISTRY)
