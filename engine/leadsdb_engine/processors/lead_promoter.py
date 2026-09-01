"""LeadPromoter — promote scored domains into CRM companies.

Reads from domain_classifications (no workspace_id — single-tenant discovery
pipeline) and creates companies + annotations in the CRM (multi-tenant, with
workspace_id). The bridge between the CT-log pipeline and the CRM.

Configuration is read from the `settings` table at the start of each cycle —
never from env vars:
    scorer_threshold        (category scorer)   minimum llm_score to promote
    promoter_interval       (category promoter) poll interval (seconds)
    promoter_batch          (category promoter) rows per batch
    promoter_workspace_id   (category promoter) target CRM workspace
"""

import time
from typing import Any

from psycopg.types.json import Jsonb

from leadsdb_engine.db import INSERT_ANNOTATION, INSERT_COMPANY, connect, get_settings_map
from leadsdb_engine.processors.base import EnrichmentProcessor

# ------------------------------------------------------------------
# Code-level fallbacks. Overridden each cycle by the settings table.
# ------------------------------------------------------------------

LLM_THRESHOLD = 0.5
PROMOTE_INTERVAL = 120
PROMOTE_BATCH = 25
DEFAULT_WORKSPACE_ID = "main"

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


class LeadPromoter(EnrichmentProcessor):
    """Promotes scored domains into CRM companies + annotations."""

    def __init__(self) -> None:
        super().__init__("lead-promoter")

    # ------------------------------------------------------------------
    # Configuration
    # ------------------------------------------------------------------

    @staticmethod
    def _load_config() -> dict[str, Any]:
        """Read tune + selection config from the settings table.

        Promotion threshold pulls from the `scorer` category (scorer_threshold)
        so promotion agrees with what the scorer scored against — one source of
        truth for lead quality. Promoter-specific tuning comes from the
        `promoter` category.
        """
        scorer = get_settings_map("scorer")
        promoter = get_settings_map("promoter")
        return {
            "threshold": float(
                (scorer.get("scorer_threshold") or {}).get("float_value") or LLM_THRESHOLD
            ),
            "interval": int(
                (promoter.get("promoter_interval") or {}).get("int_value") or PROMOTE_INTERVAL
            ),
            "batch": int(
                (promoter.get("promoter_batch") or {}).get("int_value") or PROMOTE_BATCH
            ),
            "workspace_id": (promoter.get("promoter_workspace_id") or {}).get("text_value")
            or DEFAULT_WORKSPACE_ID,
        }

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

    def _promote_row(self, row: dict[str, Any], workspace_id: str) -> None:
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
                    "workspace_id": workspace_id,
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
                    "workspace_id": workspace_id,
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
        config = self._load_config()
        self.logger.info(
            "lead promoter started",
            workspace_id=config["workspace_id"],
            threshold=config["threshold"],
            interval=config["interval"],
            batch=config["batch"],
        )

        while not self._shutdown_requested:
            try:
                # Re-read config each cycle so admin-panel changes apply live.
                config = self._load_config()
                threshold = config["threshold"]
                batch = config["batch"]
                workspace_id = config["workspace_id"]

                with connect() as conn, conn.cursor() as cur:
                    cur.execute(
                        GET_PROMOTABLE_DOMAINS,
                        {
                            "threshold": threshold,
                            "batch": batch,
                        },
                    )
                    rows = cur.fetchall()

                if not rows:
                    self.logger.info(
                        "no promotable domains, sleeping %ds", config["interval"]
                    )
                    time.sleep(config["interval"])
                    continue

                self.logger.info(
                    "promoting batch",
                    count=len(rows),
                    workspace_id=workspace_id,
                    domains=[r["registrable_domain"] for r in rows[:5]],
                )

                for row in rows:
                    try:
                        self._promote_row(row, workspace_id)
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
