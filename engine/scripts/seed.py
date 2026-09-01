#!/usr/bin/env python3
"""
Seed DB with fake data.

Usage:
    infisical run --env dev --path /leads-db -- uv run python scripts/seed.py
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from leadsdb_engine.db import connect, INSERT_DOMAIN_EVENT, INSERT_CLASSIFICATION

SAMPLE_DOMAINS = [
    {
        "registrable_domain": "acmecorp.com",
        "dns_resolves": True,
        "http_status": 200,
        "page_title": "Acme Corp — Enterprise SaaS Platform",
        "has_business_content": True,
        "has_pricing": True,
        "has_team_page": True,
        "has_contact_page": True,
        "has_about_page": True,
        "is_parked": False,
        "llm_score": 0.92,
        "llm_reasoning": "Clear enterprise SaaS company with pricing, team page, and contact info.",
    },
    {
        "registrable_domain": "bobsburgers.biz",
        "dns_resolves": True,
        "http_status": 200,
        "page_title": "Bob's Burgers — Best Burgers in Town | Menu & Delivery",
        "has_business_content": True,
        "has_pricing": False,
        "has_team_page": False,
        "has_contact_page": True,
        "has_about_page": True,
        "is_parked": False,
        "llm_score": 0.65,
        "llm_reasoning": "Local restaurant with contact and about pages, some business content.",
    },
    {
        "registrable_domain": "definitelynotalead.xyz",
        "dns_resolves": True,
        "http_status": 200,
        "page_title": "Coming Soon",
        "has_business_content": False,
        "has_pricing": False,
        "has_team_page": False,
        "has_contact_page": False,
        "has_about_page": False,
        "is_parked": True,
        "llm_score": 0.05,
        "llm_reasoning": "Parked domain, no business content.",
    },
    {
        "registrable_domain": "dataflow.io",
        "dns_resolves": True,
        "http_status": 200,
        "page_title": "DataFlow — Real-time Data Pipeline Platform | Pricing & Docs",
        "has_business_content": True,
        "has_pricing": True,
        "has_team_page": True,
        "has_contact_page": True,
        "has_about_page": True,
        "is_parked": False,
        "llm_score": 0.88,
        "llm_reasoning": "Data infrastructure company with pricing, team, and documentation.",
    },
    {
        "registrable_domain": "greenthumb.garden",
        "dns_resolves": True,
        "http_status": 200,
        "page_title": "Green Thumb Gardening Services",
        "has_business_content": True,
        "has_pricing": True,
        "has_team_page": False,
        "has_contact_page": True,
        "has_about_page": True,
        "is_parked": False,
        "llm_score": 0.72,
        "llm_reasoning": "Local service business with clear service offering and contact details.",
    },
    {
        "registrable_domain": "nilresolver.dev",
        "dns_resolves": False,
        "http_status": None,
        "page_title": None,
        "has_business_content": False,
        "has_pricing": False,
        "has_team_page": False,
        "has_contact_page": False,
        "has_about_page": False,
        "is_parked": False,
        "llm_score": None,
        "llm_reasoning": None,
    },
    {
        "registrable_domain": "parked-domain.net",
        "dns_resolves": True,
        "http_status": 200,
        "page_title": "This domain is parked — for sale",
        "has_business_content": False,
        "has_pricing": False,
        "has_team_page": False,
        "has_contact_page": False,
        "has_about_page": False,
        "is_parked": True,
        "llm_score": 0.0,
        "llm_reasoning": "Clearly a parked domain for sale.",
    },
]


def main() -> None:
    print("Seeding sample domain events...")

    with connect() as conn:
        with conn.cursor() as cur:
            for entry in SAMPLE_DOMAINS:
                cur.execute(
                    INSERT_DOMAIN_EVENT,
                    {
                        "cert_fingerprint": f"seed-{entry['registrable_domain']}",
                        "registrable_domain": entry["registrable_domain"],
                        "log_id": "seed",
                        "leaf_index": None,
                        "san_entries": [entry["registrable_domain"]],
                        "not_before": None,
                        "not_after": None,
                        "issuer": None,
                        "source": "seed",
                    },
                )
                domain_event_id = cur.fetchone()["id"]

                cur.execute(
                    INSERT_CLASSIFICATION,
                    {
                        "domain_event_id": domain_event_id,
                        "dns_resolves": entry["dns_resolves"],
                        "http_status": entry["http_status"],
                        "page_title": entry["page_title"],
                        "has_business_content": entry["has_business_content"],
                        "has_pricing": entry["has_pricing"],
                        "has_team_page": entry["has_team_page"],
                        "has_contact_page": entry["has_contact_page"],
                        "has_about_page": entry["has_about_page"],
                        "is_parked": entry["is_parked"],
                        "domain_age_days": None,
                        "llm_score": entry["llm_score"],
                        "llm_reasoning": entry["llm_reasoning"],
                    },
                )

        conn.commit()

    print(f"Seeded {len(SAMPLE_DOMAINS)} sample domains with classifications.")
    print("Run `just leadsdb-check` to verify.")


if __name__ == "__main__":
    main()
