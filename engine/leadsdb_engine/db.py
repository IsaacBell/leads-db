"""Neon Postgres database layer for LeadsDB V2.

All database operations go through this module. Connection is configured
via the LDB_DATABASE_URL environment variable (injected by Infisical).
"""

import os
from collections.abc import Generator
from contextlib import contextmanager
from typing import Any

import psycopg
from psycopg.rows import dict_row
from pydantic import BaseModel

from leadsdb_engine import crypto


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
    with connect() as conn, conn.cursor() as cur:
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


class Company(BaseModel):
    """A business entity that contacts may belong to."""

    workspace_id: str
    name: str
    domain: str | None = None
    description: str | None = None
    industry: str | None = None


class SocialLink(BaseModel):
    """A single social / web profile link for a contact."""

    contact_id: int
    platform: str
    url: str
    label: str | None = None


class Contact(BaseModel):
    """CRM contact record. PII lives here, never in docs or agent context."""

    workspace_id: str
    email: str
    company_id: int | None = None
    name: str | None = None
    role: str | None = None
    phone: str | None = None
    city: str | None = None
    country: str | None = None
    source: str = "api"
    status: str = "new"
    notes: str | None = None
    contact_type: str = "lead"


class Deal(BaseModel):
    """A sales pipeline opportunity. A contact may have many deals."""

    workspace_id: str
    contact_id: int | None = None
    company_id: int | None = None
    title: str
    description: str | None = None
    value: float | None = None
    currency: str = "USD"
    stage: str = "discovery"
    probability: int | None = None
    expected_close: str | None = None
    source: str | None = None
    source_url: str | None = None


class Annotation(BaseModel):
    """Polymorphic research annotation keyed to a contact/company/deal/domain_event.

    When target_type = 'contact', `value` (JSONB) may transitively carry PII.
    Read paths must mask it by default; reveal only with an explicit flag.
    """

    workspace_id: str
    target_type: str
    target_id: int
    source: str | None = None
    key: str
    value: Any = None
    confidence: float | None = None
    author_id: int | None = None


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
    body_preview: str | None = None


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
  -- future: add re-enrichment check here (e.g. last_classified_at threshold)
ORDER BY de.first_seen_at DESC
LIMIT %(limit)s
"""

INSERT_CLASSIFICATION = """
INSERT INTO domain_classifications
    (domain_event_id, dns_resolves, http_status, page_title,
     has_business_content, has_pricing, has_team_page,
     has_contact_page, has_about_page, is_parked,
     domain_age_days, llm_score, llm_reasoning, body_preview)
VALUES
    (%(domain_event_id)s, %(dns_resolves)s, %(http_status)s, %(page_title)s,
     %(has_business_content)s, %(has_pricing)s, %(has_team_page)s,
     %(has_contact_page)s, %(has_about_page)s, %(is_parked)s,
     %(domain_age_days)s, %(llm_score)s, %(llm_reasoning)s, %(body_preview)s)
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
    llm_reasoning = EXCLUDED.llm_reasoning,
    body_preview = EXCLUDED.body_preview
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


# --- CRM queries -------------------------------------------------------
# Contact/company PII is stored here and exposed through scoped API endpoints.
# Never include contact data in docs, logs, or debug output.

INSERT_COMPANY = """
INSERT INTO companies (workspace_id, name, domain, description, industry)
VALUES (%(workspace_id)s, %(name)s, %(domain)s, %(description)s, %(industry)s)
ON CONFLICT (workspace_id, name) WHERE deleted_at IS NULL
DO UPDATE SET
    domain = COALESCE(EXCLUDED.domain, companies.domain),
    description = COALESCE(EXCLUDED.description, companies.description),
    industry = COALESCE(EXCLUDED.industry, companies.industry),
    updated_at = NOW()
RETURNING id
"""

INSERT_CONTACT = """
INSERT INTO contacts
    (workspace_id, email, company_id, name, role, phone, city, country,
     contact_type, source, status, notes)
VALUES
    (%(workspace_id)s, %(email)s, %(company_id)s, %(name)s, %(role)s, %(phone)s,
     %(city)s, %(country)s, %(contact_type)s, %(source)s, %(status)s, %(notes)s)
ON CONFLICT (workspace_id, email)
DO UPDATE SET
    company_id = COALESCE(EXCLUDED.company_id, contacts.company_id),
    name = COALESCE(EXCLUDED.name, contacts.name),
    role = COALESCE(EXCLUDED.role, contacts.role),
    phone = COALESCE(EXCLUDED.phone, contacts.phone),
    city = COALESCE(EXCLUDED.city, contacts.city),
    country = COALESCE(EXCLUDED.country, contacts.country),
    contact_type = EXCLUDED.contact_type,
    status = EXCLUDED.status,
    notes = COALESCE(EXCLUDED.notes, contacts.notes),
    deleted_at = NULL,
    updated_at = NOW()
RETURNING id
"""

GET_CONTACT = """
SELECT c.id, c.workspace_id, c.email, c.name, c.role, c.phone,
       c.city, c.country,
       c.company_id, co.name AS company_name, co.domain AS company_domain,
       c.contact_type, c.source, c.status, c.notes,
       c.first_seen_at, c.last_contacted_at, c.created_at, c.updated_at
FROM contacts c
LEFT JOIN companies co ON co.id = c.company_id
WHERE c.id = %(id)s AND c.deleted_at IS NULL
"""

GET_CONTACT_BY_EMAIL = """
SELECT c.id, c.workspace_id, c.email, c.name, c.role, c.phone,
       c.city, c.country,
       c.company_id, co.name AS company_name, co.domain AS company_domain,
       c.contact_type, c.source, c.status, c.notes,
       c.first_seen_at, c.last_contacted_at, c.created_at, c.updated_at
FROM contacts c
LEFT JOIN companies co ON co.id = c.company_id
WHERE c.email = %(email)s AND c.workspace_id = %(workspace_id)s AND c.deleted_at IS NULL
"""

SEARCH_CONTACTS = """
SELECT c.id, c.email, c.name, co.name AS company_name, c.role,
       c.contact_type, c.source, c.status
FROM contacts c
LEFT JOIN companies co ON co.id = c.company_id
WHERE c.deleted_at IS NULL
  AND c.workspace_id = %(workspace_id)s
  AND (%(status)s IS NULL OR c.status = %(status)s)
  AND (%(q)s IS NULL
       OR c.email ILIKE %(q)s
       OR c.name ILIKE %(q)s
       OR co.name ILIKE %(q)s)
ORDER BY c.updated_at DESC
LIMIT %(limit)s OFFSET %(offset)s
"""

UPDATE_CONTACT_STATUS = """
UPDATE contacts
SET status = %(status)s,
    last_contacted_at = CASE WHEN %(contacted)s THEN NOW() ELSE last_contacted_at END,
    updated_at = NOW()
WHERE id = %(id)s AND deleted_at IS NULL
RETURNING id, email, status
"""

UPDATE_CONTACT_TYPE = """
UPDATE contacts
SET contact_type = %(contact_type)s,
    updated_at = NOW()
WHERE id = %(id)s AND deleted_at IS NULL
RETURNING id, contact_type
"""

DELETE_CONTACT = """
UPDATE contacts
SET deleted_at = NOW(), updated_at = NOW()
WHERE id = %(id)s AND deleted_at IS NULL
RETURNING id
"""

# --- Social link queries ------------------------------------------------

INSERT_SOCIAL_LINK = """
INSERT INTO social_links (contact_id, platform, url, label)
VALUES (%(contact_id)s, %(platform)s, %(url)s, %(label)s)
ON CONFLICT (contact_id, platform)
DO UPDATE SET
    url = EXCLUDED.url,
    label = COALESCE(EXCLUDED.label, social_links.label)
RETURNING id
"""

GET_SOCIAL_LINKS = """
SELECT id, platform, url, label
FROM social_links
WHERE contact_id = %(contact_id)s AND deleted_at IS NULL
ORDER BY platform
"""

DELETE_SOCIAL_LINK = """
UPDATE social_links
SET deleted_at = NOW()
WHERE id = %(id)s AND deleted_at IS NULL
RETURNING id
"""

# --- Deal queries ------------------------------------------------------

INSERT_DEAL = """
INSERT INTO deals
    (workspace_id, contact_id, company_id, title, description,
     value, currency, stage, probability, expected_close, source, source_url)
VALUES
    (%(workspace_id)s, %(contact_id)s, %(company_id)s, %(title)s, %(description)s,
     %(value)s, %(currency)s, %(stage)s, %(probability)s, %(expected_close)s,
     %(source)s, %(source_url)s)
RETURNING id
"""

GET_DEAL = """
SELECT d.id, d.workspace_id, d.contact_id, d.company_id,
       d.title, d.description, d.value, d.currency, d.stage,
       d.probability, d.expected_close, d.source, d.source_url,
       d.created_at, d.updated_at,
       co.name AS company_name, c.email AS contact_email
FROM deals d
LEFT JOIN companies co ON co.id = d.company_id
LEFT JOIN contacts c ON c.id = d.contact_id
WHERE d.id = %(id)s AND d.deleted_at IS NULL
"""

SEARCH_DEALS = """
SELECT d.id, d.title, d.stage, d.value, d.currency,
       d.contact_id, co.name AS company_name,
       d.expected_close, d.updated_at
FROM deals d
LEFT JOIN companies co ON co.id = d.company_id
WHERE d.deleted_at IS NULL
  AND d.workspace_id = %(workspace_id)s
  AND (%(stage)s IS NULL OR d.stage = %(stage)s)
  AND (%(contact_id)s IS NULL OR d.contact_id = %(contact_id)s)
ORDER BY d.updated_at DESC
LIMIT %(limit)s OFFSET %(offset)s
"""

UPDATE_DEAL_STAGE = """
UPDATE deals
SET stage = %(stage)s,
    updated_at = NOW()
WHERE id = %(id)s AND deleted_at IS NULL
RETURNING id, stage
"""

DELETE_DEAL = """
UPDATE deals
SET deleted_at = NOW(), updated_at = NOW()
WHERE id = %(id)s AND deleted_at IS NULL
RETURNING id
"""

# --- Annotation queries ------------------------------------------------
# When target_type = 'contact', callers MUST mask the JSONB `value` on read
# by default (see pii.mask_annotation_row). Only an explicit --reveal path
# should return it raw.

INSERT_ANNOTATION = """
INSERT INTO annotations
    (workspace_id, target_type, target_id, source, key, value, confidence, author_id)
VALUES
    (%(workspace_id)s, %(target_type)s, %(target_id)s, %(source)s, %(key)s,
     %(value)s, %(confidence)s, %(author_id)s)
RETURNING id
"""

GET_ANNOTATIONS = """
SELECT id, target_type, target_id, source, key, value, confidence,
       author_id, created_at, updated_at
FROM annotations
WHERE workspace_id = %(workspace_id)s
  AND deleted_at IS NULL
  AND (%(target_type)s IS NULL OR target_type = %(target_type)s)
  AND (%(target_id)s IS NULL OR target_id = %(target_id)s)
ORDER BY created_at DESC
LIMIT %(limit)s OFFSET %(offset)s
"""

DELETE_ANNOTATION = """
UPDATE annotations
SET deleted_at = NOW(), updated_at = NOW()
WHERE id = %(id)s AND deleted_at IS NULL
RETURNING id
"""


# --- Settings queries --------------------------------------------------
# The settings table stores tunable parameters and BYOK secrets. Processors
# read them at the start of each cycle; the admin panel (and the settings CLI)
# write them. Secret rows carry AES-GCM ciphertext in `encrypted_value` and
# are decrypted transparently here via leadsdb_engine.crypto. All values have
# code-level defaults in the processors — the table just overrides.

GET_SETTING = """
SELECT int_value, text_value, float_value, bool_value,
       is_secret, encrypted_value, label, description, category
FROM settings
WHERE key = %(key)s
"""

GET_SETTINGS_BY_CATEGORY = """
SELECT key, int_value, text_value, float_value, bool_value,
       is_secret, encrypted_value, label, description, category
FROM settings
WHERE category = %(category)s
"""

UPSERT_SETTING = """
INSERT INTO settings
    (key, int_value, text_value, float_value, bool_value, is_secret,
     encrypted_value, label, description, category)
VALUES
    (%(key)s, %(int_value)s, %(text_value)s, %(float_value)s, %(bool_value)s, false,
     NULL, %(label)s, %(description)s, %(category)s)
ON CONFLICT (key) DO UPDATE SET
    int_value       = COALESCE(EXCLUDED.int_value,   settings.int_value),
    text_value      = COALESCE(EXCLUDED.text_value,  settings.text_value),
    float_value     = COALESCE(EXCLUDED.float_value, settings.float_value),
    bool_value      = COALESCE(EXCLUDED.bool_value,  settings.bool_value),
    is_secret       = false,
    encrypted_value = NULL,
    label           = COALESCE(EXCLUDED.label,        settings.label),
    description     = COALESCE(EXCLUDED.description,  settings.description),
    category        = COALESCE(EXCLUDED.category,     settings.category),
    updated_at      = NOW()
"""

UPSERT_SECRET = """
INSERT INTO settings
    (key, int_value, text_value, float_value, bool_value, is_secret,
     encrypted_value, label, description, category)
VALUES
    (%(key)s, NULL, NULL, NULL, NULL, true, %(encrypted_value)s,
     %(label)s, %(description)s, %(category)s)
ON CONFLICT (key) DO UPDATE SET
    is_secret       = true,
    encrypted_value = EXCLUDED.encrypted_value,
    label           = COALESCE(EXCLUDED.label,        settings.label),
    description     = COALESCE(EXCLUDED.description,  settings.description),
    category        = COALESCE(EXCLUDED.category,     settings.category),
    updated_at      = NOW()
"""


def _decode_secret(row: dict) -> str | None:
    """Return the decrypted plaintext for a secret row, or None if unset.

    Raises crypto.CryptoError if the row carries ciphertext that cannot be
    decrypted (master key missing/rotated). Callers in processor loops catch
    Exception and log; an explicit raise here surfaces a real misconfiguration
    rather than silently idling.
    """
    if row.get("encrypted_value") is None:
        return None
    return crypto.decrypt(row["encrypted_value"])


def _row_to_setting(row: dict) -> dict:
    """Normalize a settings row into a typed dict plus a `secret_value` field.

    `secret_value` is the decrypted plaintext for is_secret rows, None for
    plain rows (or when the secret is unset).
    """
    out = {k: row.get(k) for k in ("int_value", "text_value", "float_value",
                                   "bool_value", "label", "description", "category")}
    out["is_secret"] = bool(row.get("is_secret"))
    out["secret_value"] = _decode_secret(row) if out["is_secret"] else None
    return out


def get_setting(key: str) -> dict | None:
    """Return one settings row as a typed dict, or None if the key is absent.

    Plain rows expose their typed column; secret rows expose the decrypted
    plaintext under `secret_value`. Never returns a row with raw ciphertext —
    only decrypted/plaintext fields leave this module.
    """
    with connect() as conn, conn.cursor() as cur:
        cur.execute(GET_SETTING, {"key": key})
        row = cur.fetchone()
    if row is None:
        return None
    return _row_to_setting(dict(row))


def get_settings_map(category: str) -> dict[str, dict]:
    """Return {key: typed-dict} for every setting in a category.

    Processors call this at the start of each cycle and fall back to their own
    code defaults when a key is missing or its value is None/blank.
    """
    with connect() as conn, conn.cursor() as cur:
        cur.execute(GET_SETTINGS_BY_CATEGORY, {"category": category})
        rows = cur.fetchall()
    return {r["key"]: _row_to_setting(dict(r)) for r in rows}


def set_setting(
    key: str,
    *,
    int_value: int | None = None,
    text_value: str | None = None,
    float_value: float | None = None,
    bool_value: bool | None = None,
    label: str | None = None,
    description: str | None = None,
    category: str | None = None,
) -> None:
    """Upsert aplaintext setting (typed column of your choice).

    COALESCE-on-conflict preserves any field passed as None and any seeded
    label/description, so the admin panel can update a single column without
    blanking the rest. To clear a text setting, pass text_value="" (not None).
    """
    with connect() as conn, conn.cursor() as cur:
        cur.execute(
            UPSERT_SETTING,
            {
                "key": key,
                "int_value": int_value,
                "text_value": text_value,
                "float_value": float_value,
                "bool_value": bool_value,
                "label": label,
                "description": description,
                "category": category,
            },
        )
        conn.commit()


def set_secret(
    key: str,
    plaintext: str | None,
    *,
    label: str | None = None,
    description: str | None = None,
    category: str | None = None,
) -> None:
    """Upsert an encrypted secret (BYOK API keys, delivery keys, etc.).

    plaintext=None clears the secret (stores NULL ciphertext). A non-None
    value is AES-GCM encrypted with the master key before it touches the DB —
    it is never stored in cleartext, and never logged.
    """
    encrypted = crypto.encrypt(plaintext) if plaintext else None
    with connect() as conn, conn.cursor() as cur:
        cur.execute(
            UPSERT_SECRET,
            {
                "key": key,
                "encrypted_value": encrypted,
                "label": label,
                "description": description,
                "category": category,
            },
        )
        conn.commit()
