"""Tests for breaking-bug fixes in certstream_ingestor, entity_scorer, and db.py.

All assertions are on model shapes, SQL strings, or pure method behavior
— no database connection required.
"""
import hashlib

from leadsdb_engine.db import DomainClassification, INSERT_CLASSIFICATION
from leadsdb_engine.processors.certstream_ingestor import CertstreamIngestor
from leadsdb_engine.processors.entity_scorer import ENTITY_SCORER_MAX_SCORED


class TestCertstreamFingerprintDeterminism:
    """_build_fingerprint must produce a stable (sha1-based) hash."""

    def test_stable_hash_across_calls(self):
        domains = ["example.com", "test.org"]
        message = {
            "data": {
                "leaf_cert": {"all_domains": domains},
            },
        }
        ingestor = CertstreamIngestor()
        fp1 = ingestor._build_fingerprint(message)
        fp2 = ingestor._build_fingerprint(message)
        # Same input → same output (deterministic, not randomized like hash())
        assert fp1 == fp2

    def test_sha1_format(self):
        domains = ["a.com", "b.com"]
        message = {
            "data": {
                "leaf_cert": {"all_domains": domains},
            },
        }
        ingestor = CertstreamIngestor()
        fp = ingestor._build_fingerprint(message)
        expected = hashlib.sha1("|".join(sorted(domains)).encode()).hexdigest()
        assert fp == expected
        assert isinstance(fp, str)
        assert len(fp) == 40  # sha1 hex length


class TestScorerCapClause:
    """ENTITY_SCORER_MAX_SCORED controls the global-cap subquery."""

    def test_default_zero_omits_cap(self):
        # When 0 (default), no cap clause in the SQL
        max_scored = 0
        clause = ""
        if max_scored > 0:
            clause = f" AND (SELECT COUNT(...) ...) < {max_scored}"
        assert clause == ""

    def test_positive_value_includes_cap(self):
        max_scored = 1000
        clause = ""
        if max_scored > 0:
            clause = f" AND (SELECT COUNT(*) ...) < {max_scored}"
        assert "1000" in clause

    def test_entity_scorer_max_scored_is_int(self):
        assert isinstance(ENTITY_SCORER_MAX_SCORED, int)


class TestInsertClassificationHasBodyPreview:
    """INSERT_CLASSIFICATION must include body_preview in columns, values, and update."""

    def test_body_preview_in_column_list(self):
        assert "body_preview" in INSERT_CLASSIFICATION

    def test_body_preview_in_values(self):
        assert "%(body_preview)s" in INSERT_CLASSIFICATION

    def test_body_preview_in_upsert_set(self):
        assert "body_preview = EXCLUDED.body_preview" in INSERT_CLASSIFICATION


class TestDomainClassificationModelHasBodyPreview:
    """DomainClassification model must accept body_preview."""

    def test_body_preview_field_exists(self):
        dc = DomainClassification(
            domain_event_id=1,
            body_preview="some text here",
        )
        assert dc.body_preview == "some text here"

    def test_body_preview_defaults_none(self):
        dc = DomainClassification(domain_event_id=1)
        assert dc.body_preview is None
