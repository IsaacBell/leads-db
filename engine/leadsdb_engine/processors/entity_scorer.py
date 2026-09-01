"""EntityScorer — LLM-based business entity scoring.

Only runs on domains that passed the DomainEnricher's cheap classification
(DNS resolves, not parked, some business signals). Uses an LLM to determine
if the domain represents a real business worth keeping as a lead — filtering
out personal projects, template sites, and false positives from keyword matching.

Supports both local Ollama models and OpenAI-compatible APIs.
"""

import asyncio
import json
from typing import Any

import httpx

from leadsdb_engine.db import connect
from leadsdb_engine.processors.base import EnrichmentProcessor

# ------------------------------------------------------------------
# Configuration defaults.
# Override these via the settings table (admin panel) — never env vars.
# ------------------------------------------------------------------

LLM_CONCURRENCY = 5
LLM_TIMEOUT = 30.0
LLM_THRESHOLD = 0.5
ENTITY_SCORER_MAX_SCORED = 0

# Model identity — set via settings table when an LLM is configured.
LLM_API_URL = ""
LLM_MODEL = ""
LLM_API_KEY = ""
LLM_OPENAI_MODE = False

# ------------------------------------------------------------------
# Prompt
# ------------------------------------------------------------------

CLASSIFICATION_PROMPT = """You are a business lead scoring system. Given a website's page title and content, determine whether it represents a real business that could be a B2B lead.

Return a JSON object with these fields:
- "is_business" (0-1): Score representing how likely this is a real business
- "reasoning" (str): 1-2 sentence explanation
- "category" (str): One of: "saas", "ecommerce", "agency", "local_business", "enterprise", "personal_project", "parked", "error_page", "unknown"

Rules:
- Score 0.0-0.3: Not a business (parked domain, personal project, error page, coming soon)
- Score 0.3-0.7: Possible business (small/local business, thin content, template site)
- Score 0.7-1.0: Definite business (clear product/service, pricing, team, active site)

A domain with no resolvable content or just a default page gets 0.0."""


class EntityScorer(EnrichmentProcessor):
    """Scores domain business-potential via LLM, for domains the enricher flagged."""

    def __init__(self) -> None:
        super().__init__("entity-scorer")

    # ------------------------------------------------------------------
    # LLM callers
    # ------------------------------------------------------------------

    @staticmethod
    def _build_prompt(title: str | None, body: str | None) -> str:
        domain_text = (
            f"Page title: {title or 'N/A'}\n\n"
            f"Page content (first 2000 chars):\n{(body or 'N/A')[:2000]}"
        )
        return f"{CLASSIFICATION_PROMPT}\n\nWebsite:\n{domain_text}\n\nRespond with JSON only:"

    async def _call_ollama(
        self, title: str | None, body: str | None, client: httpx.AsyncClient
    ) -> dict[str, Any]:
        """Score a domain using a local Ollama model."""
        payload = {
            "model": LLM_MODEL,
            "prompt": self._build_prompt(title, body),
            "stream": False,
            "format": "json",
        }

        raw = ""
        try:
            resp = await client.post(LLM_API_URL, json=payload, timeout=LLM_TIMEOUT)
            resp.raise_for_status()
            data = resp.json()
            raw = data.get("response", "{}")
            parsed = json.loads(raw)
            return {
                "score": float(parsed.get("is_business", 0.0)),
                "reasoning": str(parsed.get("reasoning", "")),
                "category": str(parsed.get("category", "unknown")),
            }
        except json.JSONDecodeError:
            self.logger.warning("LLM returned invalid JSON", raw=raw[:200])
            return {"score": 0.0, "reasoning": "parse error", "category": "unknown"}
        except Exception as exc:
            self.logger.warning("LLM call failed", error=str(exc))
            return {"score": 0.0, "reasoning": f"api error: {exc}", "category": "unknown"}

    async def _call_openai(
        self, title: str | None, body: str | None, client: httpx.AsyncClient
    ) -> dict[str, Any]:
        """Score a domain using an OpenAI-compatible API."""
        payload = {
            "model": LLM_MODEL,
            "messages": [
                {"role": "system", "content": CLASSIFICATION_PROMPT},
                {"role": "user", "content": self._build_prompt(title, body)},
            ],
            "response_format": {"type": "json_object"},
        }

        headers: dict[str, str] = {"Content-Type": "application/json"}
        if LLM_API_KEY:
            headers["Authorization"] = f"Bearer {LLM_API_KEY}"

        try:
            resp = await client.post(LLM_API_URL, json=payload, headers=headers, timeout=LLM_TIMEOUT)
            resp.raise_for_status()
            data = resp.json()
            raw = data.get("choices", [{}])[0].get("message", {}).get("content", "{}")
            parsed = json.loads(raw)
            return {
                "score": float(parsed.get("is_business", 0.0)),
                "reasoning": str(parsed.get("reasoning", "")),
                "category": str(parsed.get("category", "unknown")),
            }
        except Exception as exc:
            self.logger.warning("OpenAI LLM call failed", error=str(exc))
            return {"score": 0.0, "reasoning": f"api error: {exc}", "category": "unknown"}

    # ------------------------------------------------------------------
    # Main loop
    # ------------------------------------------------------------------

    async def _loop(self) -> None:
        """Repeatedly fetch LLM-ready domains, score them, and update the DB."""
        if not LLM_API_URL:
            self.logger.error(
                "entity scorer not configured — set LLM_API_URL via settings table"
            )
            return

        self.logger.info(
            "entity scorer started",
            model=LLM_MODEL,
            openai_mode=LLM_OPENAI_MODE,
            threshold=LLM_THRESHOLD,
            max_scored_cap=ENTITY_SCORER_MAX_SCORED if ENTITY_SCORER_MAX_SCORED > 0 else "unlimited",
        )

        async with httpx.AsyncClient(
            limits=httpx.Limits(max_connections=LLM_CONCURRENCY),
        ) as client:

            while not self._shutdown_requested:
                try:
                    with connect() as conn, conn.cursor() as cur:
                        max_scored_clause = ""
                        if ENTITY_SCORER_MAX_SCORED > 0:
                            max_scored_clause = (
                                f" AND (SELECT COUNT(*) FROM domain_classifications dc2"
                                f"      WHERE dc2.llm_score IS NOT NULL) < {ENTITY_SCORER_MAX_SCORED}"
                            )
                        cur.execute(
                            f"""SELECT dc.id AS classification_id,
                                      dc.domain_event_id,
                                      de.registrable_domain,
                                      dc.page_title,
                                      dc.body_preview,
                                      dc.dns_resolves,
                                      dc.is_parked,
                                      dc.http_status
                               FROM domain_classifications dc
                               JOIN domain_events de ON de.id = dc.domain_event_id
                               WHERE dc.llm_score IS NULL
                                 AND dc.dns_resolves = true
                                 AND dc.is_parked = false{max_scored_clause}
                               LIMIT 20"""
                        )
                        rows = cur.fetchall()

                    if not rows:
                        self.logger.info("no domains for entity scoring, sleeping 60s")
                        await asyncio.sleep(60)
                        continue

                    self.logger.info(
                        "scoring batch",
                        count=len(rows),
                        domains=[r["registrable_domain"] for r in rows[:5]],
                    )

                    for row in rows:
                        if LLM_OPENAI_MODE:
                            result = await self._call_openai(row["page_title"], row.get("body_preview"), client)
                        else:
                            result = await self._call_ollama(row["page_title"], row.get("body_preview"), client)

                        self.logger.info(
                            "entity score",
                            domain=row["registrable_domain"],
                            score=result["score"],
                            category=result.get("category", "unknown"),
                            reasoning=result["reasoning"],
                        )

                        with connect() as conn:
                            with conn.cursor() as cur:
                                cur.execute(
                                    """UPDATE domain_classifications
                                       SET llm_score = %s,
                                           llm_reasoning = %s,
                                           classified_at = NOW()
                                       WHERE id = %s""",
                                    (result["score"], result["reasoning"], row["classification_id"]),
                                )
                            conn.commit()

                        await asyncio.sleep(0.5)

                except Exception as exc:
                    self.logger.exception("entity scorer error", error=str(exc))
                    await asyncio.sleep(30)

    def run(self) -> None:
        """Entry point: run the scoring loop via asyncio."""
        asyncio.run(self._loop())


def main() -> None:
    """Entry point for the entity scoring processor."""
    EntityScorer().main()
