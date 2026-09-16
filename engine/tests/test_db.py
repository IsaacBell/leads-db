"""Tests for db module — SQL queries and model validation."""
import pytest
from pydantic import ValidationError
from leadsdb_engine.db import DomainEvent, DomainClassification, INSERT_DOMAIN_EVENT, INSERT_CLASSIFICATION


class TestDomainEventModel:
    def test_minimal(self):
        event = DomainEvent(cert_fingerprint="abc123", registrable_domain="example.com")
        assert event.source == "certstream"

    def test_full(self):
        event = DomainEvent(
            cert_fingerprint="abc123",
            registrable_domain="example.com",
            log_id="ct-log-1",
            leaf_index=42,
            san_entries=["example.com", "www.example.com"],
            not_before="2024-01-01T00:00:00+00:00",
            issuer="Let's Encrypt",
            source="ct_log",
        )
        assert event.leaf_index == 42
        assert event.source == "ct_log"

    def test_rejects_empty_fingerprint(self):
        with pytest.raises(ValidationError):
            DomainEvent(cert_fingerprint="", registrable_domain="example.com")

    def test_rejects_empty_domain(self):
        with pytest.raises(ValidationError):
            DomainEvent(cert_fingerprint="abc", registrable_domain="")


class TestDomainClassificationModel:
    def test_defaults(self):
        dc = DomainClassification(domain_event_id=1)
        assert dc.dns_resolves is False
        assert dc.is_parked is False
        assert dc.llm_score is None

    def test_with_score(self):
        dc = DomainClassification(domain_event_id=1, llm_score=0.85, llm_reasoning="Clear SaaS business")
        assert dc.llm_score == 0.85
        assert dc.llm_reasoning == "Clear SaaS business"


class TestInsertQueries:
    """Verify SQL templates are syntactically sound (not executing)."""

    def test_insert_domain_event_has_expected_params(self):
        assert "%(cert_fingerprint)s" in INSERT_DOMAIN_EVENT
        assert "%(registrable_domain)s" in INSERT_DOMAIN_EVENT
        assert "ON CONFLICT" in INSERT_DOMAIN_EVENT

    def test_insert_classification_has_expected_params(self):
        assert "%(domain_event_id)s" in INSERT_CLASSIFICATION
        assert "ON CONFLICT" in INSERT_CLASSIFICATION
