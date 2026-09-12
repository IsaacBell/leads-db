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

    def test_lead_promoter_reads_settings_table_not_env(self):
        # LeadPromoter loads workspace/threshold/interval/batch from the
        # settings table via get_settings_map, not from env vars.
        import inspect

        source = inspect.getsource(LeadPromoter)
        assert "get_settings_map" in source, "Promoter must read config from the settings table"
        assert "os.environ" not in source, "Promoter must not read env vars for config"
        assert "promoter_workspace_id" in source, (
            "Promoter must reference the promoter_workspace_id setting"
        )
        assert "scorer_threshold" in source, (
            "Promoter must use scorer_threshold as the promotion cutoff (single source of truth)"
        )

    def test_promote_row_uses_jsonb(self):
        # The annotation value is wrapped in Jsonb({score, reasoning}).
        import inspect

        source = inspect.getsource(LeadPromoter._promote_row)
        assert "Jsonb(" in source
