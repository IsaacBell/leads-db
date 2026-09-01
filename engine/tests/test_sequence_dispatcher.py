"""Tests for the sequence dispatcher — no DB, no network.

Covers the SQL guard string (text assertions), default sequence shape,
transport selection, and the pure dispatchability guard.
"""

from __future__ import annotations

from leadsdb_engine.processors.sequence_dispatcher import (
    DEFAULT_SEQUENCE,
    GET_OUTREACHABLE_CONTACTS,
    _parse_sequence,
    is_dispatchable,
)
from leadsdb_engine.transports import NoopTransport, get_transport


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


class TestParseSequence:
    """_parse_sequence handles None, invalid JSON, and well-formed arrays."""

    def test_none_returns_default(self) -> None:
        assert _parse_sequence(None) is DEFAULT_SEQUENCE

    def test_empty_string_returns_default(self) -> None:
        assert _parse_sequence("") is DEFAULT_SEQUENCE

    def test_invalid_json_returns_default(self) -> None:
        assert _parse_sequence("not json") is DEFAULT_SEQUENCE

    def test_empty_array_returns_default(self) -> None:
        assert _parse_sequence("[]") is DEFAULT_SEQUENCE

    def test_valid_array_parsed(self) -> None:
        custom = '[{"subject": "Hi", "body_template": "Hello {name}"}]'
        result = _parse_sequence(custom)
        assert len(result) == 1
        assert result[0]["subject"] == "Hi"


class TestNoopTransportDefault:
    """The default transport is noop — no live sends without explicit config."""

    def test_noop_is_dry_run(self) -> None:
        transport = get_transport("noop", api_key=None, from_addr=None)
        assert transport.name == "noop"
        assert transport.is_dry_run is True

    def test_noop_send_returns_dry_run_status(self) -> None:
        transport = NoopTransport(api_key=None, from_addr=None)
        result = transport.send(to="test@example.com", subject="s", text="t")
        assert result.status == "dry_run"
        assert result.message_id is None

    def test_resend_without_key_self_reports_dry_run(self) -> None:
        """ResendTransport.is_dry_run is True when no key is set (safe default)."""
        from leadsdb_engine.transports.resend import ResendTransport
        t = ResendTransport(api_key=None, from_addr=None)
        assert t.is_dry_run is True

    def test_unknown_transport_raises(self) -> None:
        from leadsdb_engine.transports import get_transport, TransportError
        try:
            get_transport("nonexistent", api_key=None, from_addr=None)
            assert False, "should have raised"
        except TransportError:
            pass


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
