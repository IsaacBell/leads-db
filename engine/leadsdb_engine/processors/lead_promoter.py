"""LeadPromoter — promote scored domains into CRM companies.

Reads from domain_classifications (no workspace_id — single-tenant discovery
pipeline) and creates companies + annotations in the CRM (multi-tenant, with
workspace_id). The bridge between the CT-log pipeline and the CRM.

Environment:
    LEADSDB_PROMOTE_WORKSPACE_ID  — target workspace for CRM records (required)
    ENTITY_SCORER_THRESHOLD        — minimum llm_score to promote (default 0.5)
    LEADSDB_PROMOTE_INTERVAL       — poll interval in seconds (default 120)
    LEADSDB_PROMOTE_BATCH          — rows per batch (default 25)
"""

import os
import time
from typing import Any

from psycopg.types.json import Jsonb

from leadsdb_engine.db import INSERT_ANNOTATION, INSERT_COMPANY, connect
from leadsdb_engine.processors.base import EnrichmentProcessor

# ------------------------------------------------------------------
# Local SQL
# ------------------------------------------------------------------
# SELECT lives here (not in db.py) to keep the db module owned by
# another track unmodified.

GET_PROMOTABLE_DOMAINS = """
SELECT dc.id, dc.domain_event_id, de.registrable_domain,
       dc.page_title, dc.llm_score, dc.llm_reasoning
FROM domain_classifications dc
JOIN domain_events de ON de.id = dc.domain_event_id
WHERE dc.llm_score >= %(threshold)s
  AND dc.promoted_company_id IS NULL
  AND de.registrable_domain IS NOT NULL
LIMIT %(batch)s
"""

UPDATE_DC_PROMOTED = """
UPDATE domain_classifications
SET promoted_company_id = %(company_id)s
WHERE id = %(dc_id)s
"""

# ------------------------------------------------------------------
# Env configuration (lazy — checked on instantiation, not at import)
# ------------------------------------------------------------------

_LLM_THRESHOLD = float(os.environ.get("ENTITY_SCORER_THRESHOLD", "0.5"))
_POLL_INTERVAL = int(os.environ.get("LEADSDB_PROMOTE_INTERVAL", "120"))
_BATCH_SIZE = int(os.environ.get("LEADSDB_PROMOTE_BATCH", "25"))


class LeadPromoter(EnrichmentProcessor):
    """Promotes scored domains into CRM companies + annotations."""

    def __init__(self) -> None:
        super().__init__("lead-promoter")
        workspace_id = os.environ.get("LEADSDB_PROMOTE_WORKSPACE_ID")
        if not workspace_id:
            raise RuntimeError(
                "LEADSDB_PROMOTE_WORKSPACE_ID is required. "
                "Set it in Infisical under /leads-db and run with:\n"
                "  infisical run --env dev --path /leads-db -- uv run python -m "
                "leadsdb_engine.processors.lead_promoter"
            )
        self.workspace_id: str = workspace_id
        self.threshold: float = _LLM_THRESHOLD
        self.interval: int = _POLL_INTERVAL
        self.batch: int = _BATCH_SIZE

    # ------------------------------------------------------------------
    # Per-row logic
    # ------------------------------------------------------------------

    @staticmethod
    def _company_name(page_title: str | None, registrable_domain: str) -> str:
        """Derive a company name from the page title or fall back to domain."""
        if page_title:
            cleaned = page_title.strip()[:80]
            if cleaned:
                return cleaned
        return registrable_domain

    def _promote_row(self, row: dict[str, Any]) -> None:
        """Insert CRM company + annotation, then mark as promoted."""
        dc_id = row["id"]
        domain_event_id = row["domain_event_id"]
        registrable_domain = row["registrable_domain"]
        page_title = row["page_title"]
        llm_score = row["llm_score"]
        llm_reasoning = row["llm_reasoning"]

        company_name = self._company_name(page_title, registrable_domain)

        with connect() as conn, conn.cursor() as cur:
            # 1. Upsert company
            cur.execute(
                INSERT_COMPANY,
                {
                    "workspace_id": self.workspace_id,
                    "name": company_name,
                    "domain": registrable_domain,
                    "description": None,
                    "industry": None,
                },
            )
            company_id = cur.fetchone()["id"]

            # 2. Insert annotation on the domain_event
            cur.execute(
                INSERT_ANNOTATION,
                {
                    "workspace_id": self.workspace_id,
                    "target_type": "domain_event",
                    "target_id": domain_event_id,
                    "source": "llm",
                    "key": "classification",
                    "value": Jsonb(
                        {
                            "score": llm_score,
                            "reasoning": llm_reasoning,
                        }
                    ),
                    "confidence": None,
                    "author_id": None,
                },
            )

            # 3. Mark domain as promoted
            cur.execute(
                UPDATE_DC_PROMOTED,
                {"company_id": company_id, "dc_id": dc_id},
            )

            conn.commit()

    # ------------------------------------------------------------------
    # Main loop
    # ------------------------------------------------------------------

    def _loop(self) -> None:
        """Poll for promotable domains and promote them."""
        self.logger.info(
            "lead promoter started",
            workspace_id=self.workspace_id,
            threshold=self.threshold,
            interval=self.interval,
            batch=self.batch,
        )

        while not self._shutdown_requested:
            try:
                with connect() as conn, conn.cursor() as cur:
                    cur.execute(
                        GET_PROMOTABLE_DOMAINS,
                        {
                            "threshold": self.threshold,
                            "batch": self.batch,
                        },
                    )
                    rows = cur.fetchall()

                if not rows:
                    self.logger.info(
                        "no promotable domains, sleeping %ds", self.interval
                    )
                    time.sleep(self.interval)
                    continue

                self.logger.info(
                    "promoting batch",
                    count=len(rows),
                    domains=[r["registrable_domain"] for r in rows[:5]],
                )

                for row in rows:
                    try:
                        self._promote_row(row)
                        self.logger.info(
                            "promoted",
                            domain=row["registrable_domain"],
                            score=row["llm_score"],
                            company_name=self._company_name(
                                row["page_title"], row["registrable_domain"]
                            ),
                        )
                    except Exception as exc:
                        self.logger.exception(
                            "failed to promote row",
                            domain=row["registrable_domain"],
                            dc_id=row["id"],
                            error=str(exc),
                        )

            except Exception as exc:
                self.logger.exception("lead promoter error", error=str(exc))
                time.sleep(30)

    def run(self) -> None:
        """Entry point: run the promotion loop (sync, no async HTTP needed)."""
        self._loop()


def main() -> None:
    """Entry point for the lead promoter processor."""
    LeadPromoter().main()
