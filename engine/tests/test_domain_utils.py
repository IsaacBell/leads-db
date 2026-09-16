"""Tests for domain_utils — domain normalization and validation."""
import pytest
from leadsdb_engine.domain_utils import normalize_domain


class TestNormalizeDomain:
    """Covers: basic normalization, IP rejection, wildcard stripping, edge cases."""

    def test_lowercases(self):
        assert normalize_domain("Example.COM") == "example.com"

    def test_strips_whitespace(self):
        assert normalize_domain("  example.com  ") == "example.com"

    def test_strips_wildcard(self):
        assert normalize_domain("*.example.com") == "example.com"

    def test_rejects_bare_ipv4(self):
        assert normalize_domain("192.168.1.1") is None

    def test_rejects_ipv6(self):
        assert normalize_domain("2001:db8::1") is None

    def test_rejects_empty(self):
        assert normalize_domain("") is None

    def test_rejects_no_dot(self):
        assert normalize_domain("localhost") is None

    def test_rejects_whitespace_only(self):
        assert normalize_domain("   ") is None

    def test_accepts_subdomain(self):
        assert normalize_domain("sub.example.com") == "sub.example.com"

    def test_accepts_co_uk(self):
        assert normalize_domain("business.co.uk") == "business.co.uk"

    def test_handles_trailing_dot(self):
        assert normalize_domain("example.com.") == "example.com."

    def test_rejects_numeric_domain(self):
        assert normalize_domain("1234567") is None

    def test_handles_mixed_case_wildcard(self):
        assert normalize_domain("*.MyDomain.COM") == "mydomain.com"
