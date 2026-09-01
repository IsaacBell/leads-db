"""EntityScorer — LLM-based business entity scoring.

Only runs on domains that passed the DomainEnricher's cheap classification
(DNS resolves, not parked, some business signals). Uses an LLM to determine
if the domain represents a real business worth keeping as a lead — filtering
out personal projects, template sites, and false positives from keyword
matching.

Bring-your-own-key (BYOK): the user supplies any OpenAI-compatible endpoint
and model via the `settings` table (scorer_api_url, scorer_model, and the
optional scorer_api_key — the key is encrypted at rest). No provider is baked
in. The scorer reads its full configuration from the `scorer` settings
category at the start of each cycle, so admin-panel changes take effect without
a restart. If the endpoint or model is blank (the seeded default), the scorer
logs once and idles — it never guesses a default host.
"""

import asyncio
import json
import re
from typing import Any

import httpx

from leadsdb_engine.db import connect, get_settings_map
from leadsdb_engine.processors.base import EnrichmentProcessor

# ------------------------------------------------------------------
# Code-level fallbacks. The `scorer` settings category overrides these
# at the start of each cycle. Never read model config from env vars.
# ------------------------------------------------------------------

LLM_CONCURRENCY = 5
LLM_TIMEOUT = 30.0
LLM_THRESHOLD = 0.5
# Kept as a module-level default for compatibility; cycle value comes from
# the `scorer_max_scored` setting (0 = unlimited).
ENTITY_SCORER_MAX_SCORED = 0

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

_JSON_OBJECT_RE = re.compile(r"\{.*\}", re.DOTALL)


class EntityScorer(EnrichmentProcessor):
    """Scores domain business-potential via LLM, for domains the enricher flagged."""

    def __init__(self) -> None:
        super().__init__("entity-scorer")

    # ------------------------------------------------------------------
    # Configuration
    # ------------------------------------------------------------------

    @staticmethod
    def _load_config() -> dict[str, Any]:
        """Read the `scorer` settings category, falling back to code defaults.

        Returns a dict with: api_url, model, api_key, concurrency, timeout,
        threshold, max_scored. api_url and model are strings ("" if unset);
        api_key is str | None (decrypted plaintext or None when the secret is
        unset / endpoint needs no auth).
        """
        cfg = get_settings_map("scorer")

        def typed(k, col, default):
            return (cfg.get(k) or {}).get(col) or default

        api_key_row = cfg.get("scorer_api_key") or {}
        return {
            "api_url": (cfg.get("scorer_api_url") or {}).get("text_value") or "",
            "model": (cfg.get("scorer_model") or {}).get("text_value") or "",
            "api_key": api_key_row.get("secret_value"),
            "concurrency": int(typed("scorer_concurrency", "int_value", LLM_CONCURRENCY)),
            "timeout": float(typed("scorer_timeout", "int_value", LLM_TIMEOUT)),
            "threshold": float(typed("scorer_threshold", "float_value", LLM_THRESHOLD)),
            "max_scored": int(typed("scorer_max_scored", "int_value", ENTITY_SCORER_MAX_SCORED)),
        }

    # ------------------------------------------------------------------
    # Prompt + LLM call
    # ------------------------------------------------------------------

    @staticmethod
    def _build_prompt(title: str | None, body: str | None) -> str:
        domain_text = (
            f"Page title: {title or 'N/A'}\n\n"
            f"Page content (first 2000 chars):\n{(body or 'N/A')[:2000]}"
        )
        return f"{CLASSIFICATION_PROMPT}\n\nWebsite:\n{domain_text}\n\nRespond with JSON only:"

    @staticmethod
    def _extract_json(text: str) -> dict[str, Any]:
        """Lenient JSON extraction — tolerant across OpenAI-compatible providers.

        Some endpoints honor response_format=json_object, some return prose
        around the object, some wrap it in markdown fences. We find the first
        balanced {...} block and parse that.
        """
        match = _JSON_OBJECT_RE.search(text or "")
        if not match:
            return {}
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return {}

    async def _call_llm(
        self,
        title: str | None,
        body: str | None,
        client: httpx.AsyncClient,
        config: dict[str, Any],
    ) -> dict[str, Any]:
        """Score a domain using any OpenAI-compatible /chat/completions endpoint.

        The Bearer header is sent only when a key is configured, so providers
        that need no auth (some local gateways) still work.
        """
        endpoint = config["api_url"]
        payload: dict[str, Any] = {
            "model": config["model"],
            "messages": [
                {"role": "system", "content": CLASSIFICATION_PROMPT},
                {"role": "user", "content": self._build_prompt(title, body)},
            ],
        }

        headers: dict[str, str] = {"Content-Type": "application/json"}
        if config.get("api_key"):
            headers["Authorization"] = f"Bearer {config['api_key']}"

        try:
            resp = await client.post(endpoint, json=payload, headers=headers, timeout=config["timeout"])
            resp.raise_for_status()
            data = resp.json()
            raw = (
                data.get("choices", [{}])[0].get("message", {}).get("content", "")
                if isinstance(data, dict)
                else ""
            )
            parsed = self._extract_json(raw)
            return {
                "score": float(parsed.get("is_business", 0.0)),
                "reasoning": str(parsed.get("reasoning", "")),
                "category": str(parsed.get("category", "unknown")),
            }
        except Exception as exc:
            self.logger.warning("LLM call failed", error=str(exc))
            return {"score": 0.0, "reasoning": f"api error: {exc}", "category": "unknown"}

    # ------------------------------------------------------------------
    # Main loop
    # ------------------------------------------------------------------

    async def _loop(self) -> None:
        """Repeatedly fetch LLM-ready domains, score them, and update the DB."""
        config = self._load_config()

        if not config["api_url"] or not config["model"]:
            self.logger.error(
                "entity scorer not configured — set scorer_api_url and "
                "scorer_model in the settings table (BYOK: any OpenAI-compatible "
                "endpoint). Idling."
            )
            return

        self.logger.info(
            "entity scorer started",
            model=config["model"],
            threshold=config["threshold"],
            max_scored_cap=config["max_scored"] if config["max_scored"] > 0 else "unlimited",
            concurrency=config["concurrency"],
        )

        async with httpx.AsyncClient(
            limits=httpx.Limits(max_connections=config["concurrency"]),
        ) as client:

            while not self._shutdown_requested:
                try:
                    # Re-read config each cycle so admin-panel changes apply live.
                    config = self._load_config()
                    if not config["api_url"] or not config["model"]:
                        self.logger.warning("scorer_api_url/scorer_model cleared; idling")
                        await asyncio.sleep(60)
                        continue

                    limit_clause = ""
                    params: dict[str, Any] = {"threshold": config["threshold"]}
                    if config["max_scored"] > 0:
                        limit_clause = (
                            " AND (SELECT COUNT(*) FROM domain_classifications dc2"
                            "      WHERE dc2.llm_score IS NOT NULL) < %(max_scored)s"
                        )
                        params["max_scored"] = config["max_scored"]

                    with connect() as conn, conn.cursor() as cur:
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
                                 AND dc.is_parked = false{limit_clause}
                               LIMIT 20""",
                            params,
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
                        result = await self._call_llm(
                            row["page_title"], row.get("body_preview"), client, config
                        )

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
