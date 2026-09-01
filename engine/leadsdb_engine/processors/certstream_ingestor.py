"""CertstreamIngestor — WebSocket → raw domain events.

Connects to the public certstream WebSocket (wss://certstream.calidog.dev/),
receives live certificate update messages, extracts Subject Alternative Names,
normalizes them to registrable domains, and inserts them into the domain_events
table as raw material for downstream enrichment.
"""

import hashlib
import json
import time
from datetime import UTC
from typing import Any

from leadsdb_engine.db import INSERT_DOMAIN_EVENT, DomainEvent, connect
from leadsdb_engine.domain_utils import normalize_domain
from leadsdb_engine.processors.base import EnrichmentProcessor

CERTSTREAM_URL = "wss://certstream.calidog.dev/"
RECONNECT_DELAY = 5.0
STATS_INTERVAL = 300  # log every 5 minutes


class CertstreamIngestor(EnrichmentProcessor):
    """Pulls certificate data from certstream and writes domain events."""

    def __init__(self) -> None:
        super().__init__("certstream-ingestor")

    # ------------------------------------------------------------------
    # Certstream message parsing
    # ------------------------------------------------------------------

    def _extract_domains(self, message: dict[str, Any]) -> list[str]:
        """Pull all unique, normalized domain names from a certstream message."""
        domains: set[str] = set()

        try:
            data = message.get("data", {})
            leaf_cert = data.get("leaf_cert", {})

            for domain in leaf_cert.get("all_domains", []):
                cleaned = normalize_domain(domain)
                if cleaned:
                    domains.add(cleaned)

            extensions = leaf_cert.get("extensions", {})
            san_text = extensions.get("subjectAltName", "")
            if san_text:
                for part in san_text.split(","):
                    part = part.strip()
                    if part.startswith("DNS:"):
                        cleaned = normalize_domain(part[4:])
                        if cleaned:
                            domains.add(cleaned)

        except (KeyError, TypeError, AttributeError) as exc:
            self.logger.warning("failed to parse certstream message", error=str(exc))

        return list(domains)

    @staticmethod
    def _build_fingerprint(message: dict[str, Any]) -> str:
        """Derive a unique cert identifier from the message for idempotency."""
        data = message.get("data", {})
        leaf_cert = data.get("leaf_cert", {})
        cert_index = data.get("cert_index")
        source_url = data.get("source", {}).get("url", "")

        if cert_index is not None:
            return f"{source_url}/{cert_index}"

        domains = leaf_cert.get("all_domains", [])
        if domains:
            return hashlib.sha1("|".join(sorted(domains)).encode()).hexdigest()

        return f"certstream-{time.time_ns()}"

    # ------------------------------------------------------------------
    # Single-message processing
    # ------------------------------------------------------------------

    def _process_message(self, message: dict[str, Any]) -> int:
        """Handle one certstream message, returning how many domains were stored."""
        if message.get("message_type") != "certificate_update":
            return 0

        domains = self._extract_domains(message)
        if not domains:
            return 0

        fingerprint = self._build_fingerprint(message)
        data = message.get("data", {})
        leaf_cert = data.get("leaf_cert", {})
        source_url = data.get("source", {}).get("url", "")
        source_name = data.get("source", {}).get("name", "")
        not_before_ts = leaf_cert.get("not_before")

        not_before_str = None
        if not_before_ts:
            from datetime import datetime
            not_before_str = datetime.fromtimestamp(not_before_ts, tz=UTC).isoformat()

        count = 0
        with connect() as conn, conn.cursor() as cur:
            for domain in domains:
                event = DomainEvent(
                    cert_fingerprint=fingerprint,
                    registrable_domain=domain,
                    log_id=f"{source_url} ({source_name})",
                    san_entries=domains,
                    not_before=not_before_str,
                    issuer=None,
                    source="certstream",
                )
                cur.execute(INSERT_DOMAIN_EVENT, event.model_dump())
                count += 1

        return count

    # ------------------------------------------------------------------
    # WebSocket loop
    # ------------------------------------------------------------------

    def run(self) -> None:
        """Connect to certstream and process messages indefinitely."""
        import websocket

        stats: dict[str, Any] = {
            "messages": 0,
            "domains": 0,
            "errors": 0,
            "started_at": time.time(),
        }

        def on_message(ws, raw: str) -> None:
            if self._shutdown_requested:
                ws.close()
                return

            try:
                message = json.loads(raw)
                count = self._process_message(message)
                stats["messages"] += 1
                stats["domains"] += count

                if stats["messages"] % STATS_INTERVAL == 0:
                    elapsed = time.time() - stats["started_at"]
                    rate = stats["messages"] / elapsed if elapsed > 0 else 0
                    self.logger.info(
                        "ingestion stats",
                        messages=stats["messages"],
                        domains_inserted=stats["domains"],
                        errors=stats["errors"],
                        elapsed_seconds=f"{elapsed:.0f}",
                        rate_per_second=f"{rate:.1f}",
                    )

            except json.JSONDecodeError as exc:
                stats["errors"] += 1
                self.logger.warning("invalid JSON from certstream", error=str(exc))
            except Exception as exc:
                stats["errors"] += 1
                self.logger.exception("error processing certstream message", error=str(exc))

        def on_error(ws, error) -> None:
            self.logger.error("certstream websocket error", error=str(error))

        def on_close(ws, close_status_code, close_msg) -> None:
            self.logger.info("certstream websocket closed", code=close_status_code, message=close_msg)

        def on_open(ws) -> None:
            self.logger.info("connected to certstream", url=CERTSTREAM_URL)

        ws = websocket.WebSocketApp(
            CERTSTREAM_URL,
            on_open=on_open,
            on_message=on_message,
            on_error=on_error,
            on_close=on_close,
        )

        while not self._shutdown_requested:
            try:
                ws.run_forever(reconnect=RECONNECT_DELAY, ping_interval=30, ping_timeout=10)
            except Exception as exc:
                if not self._shutdown_requested:
                    self.logger.error(
                        "certstream connection failed, reconnecting",
                        delay_seconds=RECONNECT_DELAY,
                        error=str(exc),
                    )
                    time.sleep(RECONNECT_DELAY)


def main() -> None:
    """Entry point for the certstream ingestion processor."""
    CertstreamIngestor().main()
