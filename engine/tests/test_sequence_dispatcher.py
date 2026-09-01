"""Tests for the sequence dispatcher — no DB, no network.

Covers the SQL guard string (text assertions), default sequence shape,
DRY-RUN detection, and the pure dispatchability guard.
"""

from __future__ import annotations

import os

os.environ.setdefault("LEADSDB_OUTREACH_WORKSPACE_ID", "00000000-0000-0000-0000-000000000000")
os.environ.setdefault("LEADSDB_PROMOTE_WORKSPACE_ID", "00000000-0000-0000-0000-000000000000")

from leadsdb_engine.processors.sequence_dispatcher import (
    DEFAULT_SEQUENCE,
    GET_OUTREACHABLE_CONTACTS,
    SEQUENCE,
    is_dispatchable,
    is_dry_run,
)


class TestGetOutreachableContactsGuard:
    """The SELECT must never return unsubscribed or soft-deleted contacts."""

    def test_excludes_unsubscribed(self) -> None:
        assert "status IN ('new', 'contacted')" in GET_OUTREACHABLE_CONTACTS, (
            "Query must restrict status to active outreach states"
        )

    def test_excludes_soft_deleted(self) -> None:
        assert "deleted_at IS NULL" in GET_OUTREACHABLE_CONTACTS, (
            "Query must exclude soft-deleted contacts"
        )

    def test_excludes_recently_logged(self) -> None:
        assert "NOT EXISTS" in GET_OUTREACHABLE_CONTACTS, (
            "Query must skip contacts with recent outreach_logs (anti-spam guard)"
        )
        assert "outreach_logs" in GET_OUTREACHABLE_CONTACTS, (
            "NOT EXISTS subquery must reference outreach_logs"
        )

    def test_filters_by_lead_type(self) -> None:
        assert "contact_type = 'lead'" in GET_OUTREACHABLE_CONTACTS, (
            "Query must restrict to lead-type contacts"
        )


class TestDefaultSequence:
    """The built-in sequence must be well-formed."""

    def test_has_three_steps(self) -> None:
        assert len(DEFAULT_SEQUENCE) == 3

    def test_each_step_has_required_keys(self) -> None:
        for i, step in enumerate(DEFAULT_SEQUENCE, start=1):
            assert "subject" in step, f"Step {i} is missing 'subject'"
            assert "body_template" in step, f"Step {i} is missing 'body_template'"
            assert isinstance(step["subject"], str)
            assert isinstance(step["body_template"], str)

    def test_sevenimport_sequence_alias(self) -> None:
        """SEQUENCE module-level constant is set (may be env-overridden)."""
        assert isinstance(SEQUENCE, list)
        assert all("subject" in s and "body_template" in s for s in SEQUENCE)


class TestDryRunDetection:
    """DRY-RUN mode activates when RESEND_API_KEY is absent."""

    def test_dry_run_when_key_unset(self) -> None:
        saved = os.environ.pop("RESEND_API_KEY", None)
        try:
            assert is_dry_run() is True
        finally:
            if saved is not None:
                os.environ["RESEND_API_KEY"] = saved

    def test_not_dry_run_when_key_set(self) -> None:
        os.environ["RESEND_API_KEY"] = "re_123"
        try:
            assert is_dry_run() is False
        finally:
            del os.environ["RESEND_API_KEY"]


class TestIsDispatchable:
    """Pure-function guard: the hard unsubscribed check."""

    def test_unsubscribed_returns_false(self) -> None:
        assert is_dispatchable(status="unsubscribed", contact_type="lead") is False
        assert is_dispatchable(status="unsubscribed", contact_type="contact") is False

    def test_new_lead_returns_true(self) -> None:
        assert is_dispatchable(status="new", contact_type="lead") is True

    def test_contacted_lead_returns_true(self) -> None:
        assert is_dispatchable(status="contacted", contact_type="lead") is True

    def test_non_lead_returns_false(self) -> None:
        assert is_dispatchable(status="new", contact_type="contact") is False
