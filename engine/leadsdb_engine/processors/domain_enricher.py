"""DomainEnricher — DNS check + HTTP fetch + rule-based classification.

Takes raw domain events from the domain_events table and runs them through:
1. DNS resolution — does the domain resolve at all?
2. HTTP fetch — what status, title, and body text does it serve?
3. Rule-based classification — is it parked? Does it have business content?

Domains that look promising (resolves, not parked, some business signals) are
flagged as LLM candidates for the EntityScorer.
"""

import asyncio
import re
import time
from typing import Any

import dns.resolver
import httpx

from leadsdb_engine.db import (
    connect,
    GET_UNCLASSIFIED_DOMAINS,
    INSERT_CLASSIFICATION,
    DomainClassification,
)
from leadsdb_engine.processors.base import EnrichmentProcessor

# ------------------------------------------------------------------
# Configuration defaults.
# Override these via the settings table (admin panel) — never env vars.
# ------------------------------------------------------------------

BATCH_SIZE = 50
CONCURRENCY = 10
HTTP_TIMEOUT = 10.0
DNS_TIMEOUT = 5.0

# ------------------------------------------------------------------
# Keyword heuristics
# ------------------------------------------------------------------

BUSINESS_KEYWORDS: list[str] = [
    "pricing", "plans", "subscribe", "products", "solutions",
    "services", "contact us", "about us", "our team", "careers",
    "blog", "case studies", "docs", "documentation", "api",
    "sign up", "get started", "free trial", "demo", "enterprise",
    "platform", "features", "integrations", "partners",
    "support", "help center", "status",
]

PARKED_INDICATORS: list[str] = [
    "this domain is parked", "domain parked", "buy this domain",
    "domain is for sale", "for sale", "this web page is parked",
    "coming soon", "under construction", "website coming soon",
    "hosting provider", "registerdomain", "sedo", "afternic",
    "this site is no longer available", "account suspended",
    "this domain has been registered", "domain name",
    "default page", "default website", "welcome to nginx",
    "it works", "index of /", "403 forbidden", "404 not found",
    "no website configured", "server default page",
]

HIGH_VALUE_TITLE_PATTERNS: list[str] = [
    r"(?i)\b(ai|saas|platform|enterprise|cloud|api)\b",
    r"(?i)(\w+\s+(software|app|platform|solution|service))",
    r"(?i)\b(inc\.?|llc|ltd|co\.|corp|io)\b",
]


class DomainEnricher(EnrichmentProcessor):
    """DNS-resolves, HTTP-fetches, and rule-classifies raw domain events."""

    def __init__(self) -> None:
        super().__init__("domain-enricher")

    # ------------------------------------------------------------------
    # DNS
    # ------------------------------------------------------------------

    @staticmethod
    async def _resolve_dns(domain: str) -> bool:
        """Check whether a domain has any A, AAAA, or CNAME records."""
        try:
            resolver = dns.resolver.Resolver()
            resolver.timeout = DNS_TIMEOUT
            resolver.lifetime = DNS_TIMEOUT

            for query_type in ("A", "AAAA", "CNAME"):
                try:
                    await asyncio.get_event_loop().run_in_executor(
                        None, lambda qt=query_type: resolver.resolve(domain, qt)
                    )
                    return True
                except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN):
                    continue
                except dns.resolver.Timeout:
                    continue
                except Exception:
                    continue
            return False
        except Exception:
            return False

    # ------------------------------------------------------------------
    # HTTP fetch
    # ------------------------------------------------------------------

    @staticmethod
    async def _fetch_page(domain: str, client: httpx.AsyncClient) -> dict[str, Any]:
        """Fetch a domain's landing page. Returns status, title, and a body preview."""
        result: dict[str, Any] = {
            "http_status": None,
            "page_title": None,
            "body_preview": None,
        }

        for scheme in ("https://", "http://"):
            try:
                resp = await client.get(
                    f"{scheme}{domain}",
                    follow_redirects=True,
                    timeout=HTTP_TIMEOUT,
                    headers={
                        "User-Agent": "Mozilla/5.0 (compatible; LeadsDBEnricher/1.0; +https://leads-db.com)",
                        "Accept": "text/html,application/xhtml+xml",
                    },
                )
                result["http_status"] = resp.status_code
                text = resp.text

                title_match = re.search(
                    r"<title[^>]*>(.*?)</title>", text, re.IGNORECASE | re.DOTALL
                )
                if title_match:
                    result["page_title"] = title_match.group(1).strip()[:200]

                body_match = re.search(
                    r"<body[^>]*>(.*?)</body>", text, re.IGNORECASE | re.DOTALL
                )
                if body_match:
                    raw_body = re.sub(r"<[^>]+>", " ", body_match.group(1))
                    raw_body = re.sub(r"\s+", " ", raw_body).strip()
                    result["body_preview"] = raw_body[:2000]

                return result

            except (httpx.TimeoutException, httpx.ConnectError, httpx.RemoteProtocolError):
                continue
            except Exception:
                continue

        return result

    # ------------------------------------------------------------------
    # Rule classification
    # ------------------------------------------------------------------

    @staticmethod
    def _classify_by_rules(
        domain: str,
        dns_resolves: bool,
        page_data: dict[str, Any],
    ) -> dict[str, Any]:
        """Apply keyword heuristics to classify a domain's business potential."""
        result: dict[str, Any] = {
            "dns_resolves": dns_resolves,
            "http_status": page_data.get("http_status"),
            "page_title": page_data.get("page_title"),
            "has_business_content": False,
            "has_pricing": False,
            "has_team_page": False,
            "has_contact_page": False,
            "has_about_page": False,
            "is_parked": False,
            "llm_candidate": False,
        }

        title = (page_data.get("page_title") or "").lower()
        body = (page_data.get("body_preview") or "").lower()

        # Can't reach it at all — no signal
        if not dns_resolves and page_data.get("http_status") is None:
            return result

        # Parked indicators short-circuit
        for indicator in PARKED_INDICATORS:
            if indicator in title or indicator in body:
                result["is_parked"] = True
                return result

        # Score business keyword matches
        business_score = 0
        for keyword in BUSINESS_KEYWORDS:
            if keyword in body:
                business_score += 1
                if keyword in ("pricing", "plans"):
                    result["has_pricing"] = True
                elif keyword in ("our team", "careers"):
                    result["has_team_page"] = True
                elif keyword in ("contact us",):
                    result["has_contact_page"] = True
                elif keyword in ("about us",):
                    result["has_about_page"] = True

        for pattern in HIGH_VALUE_TITLE_PATTERNS:
            if re.search(pattern, title):
                business_score += 3

        result["has_business_content"] = business_score >= 2

        # Flag for LLM scoring if it shows any business signal
        result["llm_candidate"] = (
            dns_resolves
            and not result["is_parked"]
            and business_score >= 1
        )

        return result

    # ------------------------------------------------------------------
    # Batch processing
    # ------------------------------------------------------------------

    async def _process_batch(self, rows: list[dict[str, Any]]) -> list[DomainClassification]:
        """Classify a batch of domains concurrently and return results."""
        semaphore = asyncio.Semaphore(CONCURRENCY)
        results: list[DomainClassification] = []

        async with httpx.AsyncClient(
            limits=httpx.Limits(max_connections=CONCURRENCY),
            timeout=httpx.Timeout(HTTP_TIMEOUT),
        ) as client:

            async def _process_one(row: dict[str, Any]) -> DomainClassification | None:
                domain = row["registrable_domain"]
                domain_event_id = row["id"]

                async with semaphore:
                    try:
                        dns_ok = await self._resolve_dns(domain)
                        page_data = await self._fetch_page(domain, client)
                        rules = self._classify_by_rules(domain, dns_ok, page_data)

                        return DomainClassification(
                            domain_event_id=domain_event_id,
                            dns_resolves=rules["dns_resolves"],
                            http_status=rules["http_status"],
                            page_title=rules["page_title"],
                            has_business_content=rules["has_business_content"],
                            has_pricing=rules["has_pricing"],
                            has_team_page=rules["has_team_page"],
                            has_contact_page=rules["has_contact_page"],
                            has_about_page=rules["has_about_page"],
                            is_parked=rules["is_parked"],
                            body_preview=page_data.get("body_preview"),
                        )
                    except Exception as exc:
                        self.logger.error("enrichment error", domain=domain, error=str(exc))
                        return None

            tasks = [_process_one(row) for row in rows]
            completed = await asyncio.gather(*tasks)

        return [r for r in completed if r is not None]

    # ------------------------------------------------------------------
    # Main loop
    # ------------------------------------------------------------------

    async def _loop(self) -> None:
        """Repeatedly fetch unclassified domains, enrich them, and store results."""
        self.logger.info(
            "domain enricher started",
            batch_size=BATCH_SIZE,
            concurrency=CONCURRENCY,
        )

        while not self._shutdown_requested:
            try:
                with connect() as conn:
                    with conn.cursor() as cur:
                        cur.execute(GET_UNCLASSIFIED_DOMAINS, {"limit": BATCH_SIZE})
                        rows = cur.fetchall()

                if not rows:
                    self.logger.info("no unclassified domains, sleeping 30s")
                    await asyncio.sleep(30)
                    continue

                self.logger.info(
                    "enriching batch",
                    count=len(rows),
                    domains=[r["registrable_domain"] for r in rows[:5]],
                )

                results = await self._process_batch(rows)

                with connect() as conn:
                    with conn.cursor() as cur:
                        for cls in results:
                            cur.execute(INSERT_CLASSIFICATION, cls.model_dump())
                    conn.commit()

                self.logger.info("batch complete", processed=len(results), total=len(rows))
                await asyncio.sleep(1)

            except Exception as exc:
                self.logger.exception("enricher loop error", error=str(exc))
                await asyncio.sleep(30)

    def run(self) -> None:
        """Entry point: run the enrichment loop via asyncio."""
        asyncio.run(self._loop())


def main() -> None:
    """Entry point for the domain enrichment processor."""
    DomainEnricher().main()
