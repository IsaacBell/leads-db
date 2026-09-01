"""Tests for CRM models, SQL templates, and PII masking — no DB connection required.

These mirror the style of test_db.py: validate model shapes and SQL strings
syntactically, and exercise the Safe Harbor masking helpers, without executing
anything against Postgres.
"""
import pytest
from pydantic import ValidationError

from leadsdb_engine.db import (
    Contact,
    Deal,
    Annotation,
    SocialLink,
    INSERT_COMPANY,
    INSERT_CONTACT,
    INSERT_DEAL,
    INSERT_ANNOTATION,
    UPDATE_CONTACT_TYPE,
)
from leadsdb_engine.pii import mask_contact_row, mask_annotation_row


# ── Models ──────────────────────────────────────────────────────────────


class TestContactModel:
    def test_defaults_lead_and_new(self):
        c = Contact(workspace_id="ws-1", email="j@ex.com")
        assert c.contact_type == "lead"
        assert c.status == "new"
        assert c.source == "api"

    def test_accepts_contact_type_and_customer_status(self):
        c = Contact(
            workspace_id="ws-1",
            email="j@ex.com",
            contact_type="contact",
            status="customer",
        )
        assert c.contact_type == "contact"
        assert c.status == "customer"

    def test_requires_email(self):
        # `email` is required (no default); omitting it must raise.
        with pytest.raises(ValidationError):
            Contact(workspace_id="ws-1")


class TestDealModel:
    def test_defaults(self):
        d = Deal(workspace_id="ws-1", title="Q3 retainer")
        assert d.stage == "discovery"
        assert d.currency == "USD"
        assert d.value is None
        assert d.probability is None

    def test_with_value(self):
        d = Deal(workspace_id="ws-1", title="X", value=12000.0, probability=80)
        assert d.value == 12000.0
        assert d.probability == 80


class TestAnnotationModel:
    def test_defaults(self):
        a = Annotation(workspace_id="ws-1", target_type="contact", target_id=42, key="linkedin")
        assert a.value is None
        assert a.confidence is None

    def test_carries_json_value(self):
        a = Annotation(
            workspace_id="ws-1",
            target_type="contact",
            target_id=42,
            key="exa",
            value={"headline": "CTO", "url": "https://x.invalid/in/jane"},
        )
        assert a.value["headline"] == "CTO"


# ── SQL templates ───────────────────────────────────────────────────────


class TestCrmQueries:
    """Verify SQL templates are syntactically sound (not executing)."""

    def test_insert_company_uses_partial_index_predicate(self):
        # Regression: ON CONFLICT must match the partial unique index
        # (workspace_id, name) WHERE deleted_at IS NULL. Without the predicate,
        # Postgres cannot resolve the conflict arbiter and the upsert errors.
        assert "ON CONFLICT (workspace_id, name) WHERE deleted_at IS NULL" in INSERT_COMPANY

    def test_insert_contact_includes_contact_type(self):
        assert "%(contact_type)s" in INSERT_CONTACT
        assert "contact_type = EXCLUDED.contact_type" in INSERT_CONTACT

    def test_insert_contact_revives_soft_deleted_row(self):
        # Regression: on upsert against a soft-deleted contact's email, the
        # ON CONFLICT branch MUST clear deleted_at — otherwise the row stays
        # invisible to all read paths (which filter WHERE deleted_at IS NULL)
        # while INSERT reports success. Re-adding a deleted contact must revive it.
        assert "deleted_at = NULL" in INSERT_CONTACT

    def test_insert_deal_returns_id(self):
        assert "INSERT INTO deals" in INSERT_DEAL
        assert "%(title)s" in INSERT_DEAL
        assert "%(value)s" in INSERT_DEAL
        assert "%(stage)s" in INSERT_DEAL
        assert "RETURNING id" in INSERT_DEAL
        # Deals have no natural unique key — no upsert.
        assert "ON CONFLICT" not in INSERT_DEAL

    def test_insert_annotation_params(self):
        assert "%(target_type)s" in INSERT_ANNOTATION
        assert "%(target_id)s" in INSERT_ANNOTATION
        assert "%(key)s" in INSERT_ANNOTATION
        assert "%(value)s" in INSERT_ANNOTATION
        assert "RETURNING id" in INSERT_ANNOTATION

    def test_update_contact_type_exists(self):
        assert "contact_type = %(contact_type)s" in UPDATE_CONTACT_TYPE
        assert "deleted_at IS NULL" in UPDATE_CONTACT_TYPE


# ── PII masking ─────────────────────────────────────────────────────────


class TestPiiMasking:
    def test_mask_contact_row_masks_email_name_phone(self):
        row = {
            "id": 1,
            "email": "jane@example.com",
            "name": "Jane Doe",
            "phone": "+1-415-555-1234",
            "status": "new",
            "contact_type": "lead",
        }
        masked = mask_contact_row(row)
        assert masked["email"] != "jane@example.com"
        assert masked["name"] != "Jane Doe"
        assert "1234" in masked["phone"]
        # Non-PII fields untouched.
        assert masked["status"] == "new"
        assert masked["contact_type"] == "lead"

    def test_mask_annotation_row_redacts_contact_target(self):
        row = {
            "id": 7,
            "target_type": "contact",
            "target_id": 42,
            "key": "exa",
            "value": {"headline": "CTO at Acme", "email": "jane@acme.com"},
            "confidence": 0.9,
        }
        masked = mask_annotation_row(row)
        assert "redacted" in str(masked["value"]).lower()
        # Metadata preserved.
        assert masked["key"] == "exa"
        assert masked["target_id"] == 42

    def test_mask_annotation_row_reveals_contact_target(self):
        row = {
            "target_type": "contact",
            "value": {"headline": "CTO"},
        }
        revealed = mask_annotation_row(row, reveal=True)
        assert revealed["value"] == {"headline": "CTO"}

    def test_mask_annotation_row_leaves_non_contact_target_intact(self):
        row = {
            "target_type": "company",
            "value": {"industry": "SaaS"},
        }
        masked = mask_annotation_row(row)
        assert masked["value"] == {"industry": "SaaS"}
