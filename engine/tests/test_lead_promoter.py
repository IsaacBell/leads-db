"""Tests for LeadPromoter — no DB connection required.

Validates SQL constants, import paths, and env-variable references
syntactically, without executing anything against Postgres.
"""

from leadsdb_engine.processors.lead_promoter import (
    GET_PROMOTABLE_DOMAINS,
    UPDATE_DC_PROMOTED,
    LeadPromoter,
)
from leadsdb_engine.db import INSERT_COMPANY, INSERT_ANNOTATION


class TestSqlConstants:
    """Validate promotion SQL templates are syntactically sound."""

    def test_get_promotable_domains_joins_classifications_and_events(self):
        assert "domain_classifications dc" in GET_PROMOTABLE_DOMAINS
        assert "domain_events de" in GET_PROMOTABLE_DOMAINS

    def test_get_promotable_domains_filters_unpromoted(self):
        assert "promoted_company_id IS NULL" in GET_PROMOTABLE_DOMAINS

    def test_get_promotable_domains_filters_by_score(self):
        assert "llm_score >=" in GET_PROMOTABLE_DOMAINS

    def test_get_promotable_domains_limits_batch(self):
        assert "LIMIT" in GET_PROMOTABLE_DOMAINS
        assert "%(batch)s" in GET_PROMOTABLE_DOMAINS

    def test_update_dc_promoted_sets_company_id(self):
        assert "promoted_company_id = %(company_id)s" in UPDATE_DC_PROMOTED
        assert "WHERE id = %(dc_id)s" in UPDATE_DC_PROMOTED


class TestImportsAndReferences:
    """Verify LeadPromoter references the correct db symbols."""

    def test_insert_company_imported_from_db(self):
        # LeadPromoter uses INSERT_COMPANY to upsert companies.
        assert "INSERT INTO companies" in INSERT_COMPANY
        assert "%(workspace_id)s" in INSERT_COMPANY

    def test_insert_annotation_imported_from_db(self):
        # LeadPromoter uses INSERT_ANNOTATION for domain_event annotations.
        assert "INSERT INTO annotations" in INSERT_ANNOTATION
        assert "%(target_type)s" in INSERT_ANNOTATION

    def test_lead_promoter_has_workspace_id(self):
        # LeadPromoter reads LEADSDB_PROMOTE_WORKSPACE_ID from env.
        import os

        # The module-level check raises RuntimeError if unset.
        # We just verify the env var name is referenced in the module.
        assert "LEADSDB_PROMOTE_WORKSPACE_ID" in open(
            "leadsdb_engine/processors/lead_promoter.py"
        ).read()

    def test_lead_promoter_reuses_threshold_env(self):
        # ENTITY_SCORER_THRESHOLD is the same env var entity_scorer.py uses.
        assert "ENTITY_SCORER_THRESHOLD" in open(
            "leadsdb_engine/processors/lead_promoter.py"
        ).read()

    def test_promote_row_uses_jsonb(self):
        # The annotation value is wrapped in Jsonb({score, reasoning}).
        import inspect

        source = inspect.getsource(LeadPromoter._promote_row)
        assert "Jsonb(" in source
