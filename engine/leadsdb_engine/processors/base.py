"""Base class for all enrichment processors.

Reduces duplication across the three pipeline stages — certstream ingestion,
DNS/HTTP enrichment, and LLM-based entity scoring — by factoring out shared
startup, signal handling, and logging setup.
"""

import abc
import signal
import sys

import structlog

from leadsdb_engine.db import connect


class EnrichmentProcessor(abc.ABC):
    """Shared scaffold for a lead-enrichment pipeline processor.

    Subclasses override run() with their specific loop logic. The main()
    method handles startup ceremony so each processor is just a few lines.
    """

    def __init__(self, name: str) -> None:
        self.name = name
        self.logger = structlog.get_logger()
        self._shutdown_requested = False

    # ------------------------------------------------------------------
    # Subclass hook
    # ------------------------------------------------------------------

    @abc.abstractmethod
    def run(self) -> None:
        """Main processing loop. Called after DB check and signal setup."""

    # ------------------------------------------------------------------
    # Startup boilerplate
    # ------------------------------------------------------------------

    def check_database(self) -> None:
        """Verify database is reachable before entering the main loop."""
        try:
            with connect() as conn:
                conn.execute("SELECT 1")
            self.logger.info("database connection ok")
        except Exception as exc:
            self.logger.error("database connection failed", error=str(exc))
            sys.exit(1)

    def setup_signal_handlers(self) -> None:
        """Install SIGINT/SIGTERM handlers for graceful shutdown."""
        def _handler(signum, frame):
            self._shutdown_requested = True
            self.logger.info("shutdown requested")

        signal.signal(signal.SIGINT, _handler)
        signal.signal(signal.SIGTERM, _handler)

    def main(self) -> None:
        """Entry point: configure logging, check DB, install signals, run."""
        structlog.configure(
            processors=[
                structlog.stdlib.add_log_level,
                structlog.dev.ConsoleRenderer(),
            ],
            cache_logger_on_first_use=True,
        )

        self.logger.info(f"starting {self.name}")
        self.check_database()
        self.setup_signal_handlers()
        self.run()
        self.logger.info(f"{self.name} stopped")
