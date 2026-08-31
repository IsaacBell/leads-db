"""Neon Postgres database layer for LeadsDB V2.

All database operations go through this module. Connection is configured
via the LDB_DATABASE_URL environment variable (injected by Infisical).
"""

import os
from contextlib import contextmanager
from typing import Generator

import psycopg
from psycopg.rows import dict_row
from pydantic import BaseModel


def _connection_string() -> str:
    url = os.environ.get("LDB_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError(
            "LDB_DATABASE_URL (or DATABASE_URL) must be set. "
            "Run with: infisical run --env dev --path /leads-db -- <cmd>"
        )
    return url


@contextmanager
def connect() -> Generator[psycopg.Connection, None, None]:
    """Context manager yielding a Postgres connection.

    Usage:
        with connect() as conn:
            conn.execute("SELECT 1")
    """
    conn = psycopg.connect(_connection_string(), row_factory=dict_row)
    try:
        yield conn
        conn.commit()
    except BaseException:
        conn.rollback()
        raise
    finally:
        conn.close()


@contextmanager
def get_cursor():
    """Convenience: yield a cursor from a managed connection."""
    with connect() as conn:
        with conn.cursor() as cur:
            yield cur


# --- Models -----------------------------------------------------------
# These mirror the Neon Postgres schema. They are used for type safety
# when inserting/reading rows, not as an ORM layer.


class DomainEvent(BaseModel):
    """A certificate-issued domain observed via a CT log or certstream."""

    cert_fingerprint: str
    registrable_domain: str
    log_id: str | None = None
    leaf_index: int | None = None
    san_entries: list[str] = []
    not_before: str | None = None
    not_after: str | None = None
    issuer: str | None = None
    source: str = "certstream"  # 'certstream', 'ct_log', 'seed'


class DomainClassification(BaseModel):
    """Cheap pre-LLM classification for a domain."""

    domain_event_id: int
    dns_resolves: bool = False
    http_status: int | None = None
    page_title: str | None = None
    has_business_content: bool = False
    has_pricing: bool = False
    has_team_page: bool = False
    has_contact_page: bool = False
    has_about_page: bool = False
    is_parked: bool = False
    domain_age_days: int | None = None
    llm_score: float | None = None
    llm_reasoning: str | None = None


# --- Queries ----------------------------------------------------------
# These are parameterized SQL strings kept close to the model definitions.


INSERT_DOMAIN_EVENT = """
INSERT INTO domain_events
    (cert_fingerprint, registrable_domain, log_id, leaf_index,
     san_entries, not_before, not_after, issuer, source)
VALUES
    (%(cert_fingerprint)s, %(registrable_domain)s, %(log_id)s, %(leaf_index)s,
     %(san_entries)s, %(not_before)s, %(not_after)s, %(issuer)s, %(source)s)
ON CONFLICT (cert_fingerprint, registrable_domain)
DO UPDATE SET
    last_seen_at = NOW(),
    san_entries = EXCLUDED.san_entries
RETURNING id
"""

GET_UNCLASSIFIED_DOMAINS = """
SELECT de.id, de.registrable_domain, de.san_entries, de.not_before
FROM domain_events de
LEFT JOIN domain_classifications dc ON dc.domain_event_id = de.id
WHERE dc.id IS NULL
  AND (de.last_classified_at IS NULL OR de.last_classified_at < NOW() - INTERVAL '1 day')
ORDER BY de.first_seen_at DESC
LIMIT %(limit)s
"""

INSERT_CLASSIFICATION = """
INSERT INTO domain_classifications
    (domain_event_id, dns_resolves, http_status, page_title,
     has_business_content, has_pricing, has_team_page,
     has_contact_page, has_about_page, is_parked,
     domain_age_days, llm_score, llm_reasoning)
VALUES
    (%(domain_event_id)s, %(dns_resolves)s, %(http_status)s, %(page_title)s,
     %(has_business_content)s, %(has_pricing)s, %(has_team_page)s,
     %(has_contact_page)s, %(has_about_page)s, %(is_parked)s,
     %(domain_age_days)s, %(llm_score)s, %(llm_reasoning)s)
ON CONFLICT (domain_event_id)
DO UPDATE SET
    classified_at = NOW(),
    dns_resolves = EXCLUDED.dns_resolves,
    http_status = EXCLUDED.http_status,
    page_title = EXCLUDED.page_title,
    has_business_content = EXCLUDED.has_business_content,
    has_pricing = EXCLUDED.has_pricing,
    has_team_page = EXCLUDED.has_team_page,
    has_contact_page = EXCLUDED.has_contact_page,
    has_about_page = EXCLUDED.has_about_page,
    is_parked = EXCLUDED.is_parked,
    domain_age_days = EXCLUDED.domain_age_days,
    llm_score = EXCLUDED.llm_score,
    llm_reasoning = EXCLUDED.llm_reasoning
"""

GET_LEADS = """
SELECT
    de.registrable_domain,
    de.san_entries,
    de.not_before,
    de.first_seen_at,
    dc.dns_resolves,
    dc.http_status,
    dc.page_title,
    dc.has_business_content,
    dc.has_pricing,
    dc.has_team_page,
    dc.has_about_page,
    dc.has_contact_page,
    dc.is_parked,
    dc.llm_score,
    dc.llm_reasoning
FROM domain_events de
JOIN domain_classifications dc ON dc.domain_event_id = de.id
WHERE dc.has_business_content = true
  AND dc.is_parked = false
  AND (dc.llm_score IS NULL OR dc.llm_score >= %(min_llm_score)s)
ORDER BY dc.llm_score DESC NULLS LAST, de.first_seen_at DESC
LIMIT %(limit)s OFFSET %(offset)s
"""

COUNT_LEADS = """
SELECT COUNT(*) as total
FROM domain_events de
JOIN domain_classifications dc ON dc.domain_event_id = de.id
WHERE dc.has_business_content = true
  AND dc.is_parked = false
  AND (dc.llm_score IS NULL OR dc.llm_score >= %(min_llm_score)s)
"""
