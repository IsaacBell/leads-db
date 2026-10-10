"""Tests for net_guard — address, host and redirect checks with no network."""
import asyncio
import ipaddress
import socket

import pytest

from leadsdb_engine.net_guard import (
    BlockedHost,
    assert_public_host,
    fetch_public,
    is_public_address,
)

NON_PUBLIC = [
    "127.0.0.1",
    "::1",
    "10.0.0.5",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "::ffff:127.0.0.1",
]


def install_resolver(monkeypatch, mapping):
    """Replace the event loop resolver with a table lookup.

    ``mapping`` maps a hostname to a list of addresses, an empty list for an
    empty answer, or None to make resolution fail. A host that is not listed
    is treated as the literal IP address it already is.
    """

    async def resolver(_loop, host, port, *args, **kwargs):
        addresses = mapping.get(host)
        if addresses is None:
            try:
                ipaddress.ip_address(host.split("%", 1)[0])
            except ValueError as exc:
                raise socket.gaierror(socket.EAI_NONAME, "Name not known") from exc
            addresses = [host]
        return [
            (
                socket.AF_INET6 if ":" in address else socket.AF_INET,
                socket.SOCK_STREAM,
                socket.IPPROTO_TCP,
                "",
                (address, port),
            )
            for address in addresses
        ]

    monkeypatch.setattr(asyncio.BaseEventLoop, "getaddrinfo", resolver)


class FakeResponse:
    def __init__(self, status_code, headers=None):
        self.status_code = status_code
        self.headers = headers or {}

    @property
    def is_redirect(self):
        return 300 <= self.status_code < 400


class FakeClient:
    def __init__(self, responses):
        self._responses = list(responses)
        self.calls = []

    async def get(self, url, *, follow_redirects=False, **kwargs):
        self.calls.append(
            {"url": url, "follow_redirects": follow_redirects, "kwargs": kwargs}
        )
        return self._responses.pop(0)


class TestIsPublicAddress:
    """Covers the address-class check used before every request."""

    @pytest.mark.parametrize("address", NON_PUBLIC)
    def test_rejects_non_public(self, address):
        assert is_public_address(address) is False

    def test_accepts_public(self):
        assert is_public_address("93.184.216.34") is True

    def test_rejects_garbage(self):
        assert is_public_address("not-an-ip") is False


class TestAssertPublicHost:
    """Covers host resolution and the all-answers-must-be-public rule."""

    def test_literal_loopback_blocked(self, monkeypatch):
        install_resolver(monkeypatch, {})
        with pytest.raises(BlockedHost):
            asyncio.run(assert_public_host("127.0.0.1", 80))

    def test_literal_ipv6_loopback_blocked(self, monkeypatch):
        install_resolver(monkeypatch, {})
        with pytest.raises(BlockedHost):
            asyncio.run(assert_public_host("::1", 443))

    def test_hostname_resolving_to_loopback_blocked(self, monkeypatch):
        install_resolver(monkeypatch, {"loop.example": ["127.0.0.1"]})
        with pytest.raises(BlockedHost):
            asyncio.run(assert_public_host("loop.example", 443))

    def test_mixed_public_and_private_blocked(self, monkeypatch):
        install_resolver(
            monkeypatch, {"mixed.example": ["93.184.216.34", "10.0.0.5"]}
        )
        with pytest.raises(BlockedHost):
            asyncio.run(assert_public_host("mixed.example", 443))

    def test_resolution_failure_blocked(self, monkeypatch):
        install_resolver(monkeypatch, {"missing.example": None})
        with pytest.raises(BlockedHost):
            asyncio.run(assert_public_host("missing.example", 443))

    def test_empty_answer_blocked(self, monkeypatch):
        install_resolver(monkeypatch, {"empty.example": []})
        with pytest.raises(BlockedHost):
            asyncio.run(assert_public_host("empty.example", 443))

    def test_public_host_allowed(self, monkeypatch):
        install_resolver(monkeypatch, {"good.example": ["93.184.216.34"]})
        asyncio.run(assert_public_host("good.example", 443))


class TestFetchPublic:
    """Covers per-hop checks and manual redirect following."""

    def test_redirect_to_metadata_refused(self, monkeypatch):
        install_resolver(monkeypatch, {"evil.example": ["93.184.216.34"]})
        client = FakeClient(
            [FakeResponse(302, {"Location": "http://169.254.169.254/"})]
        )
        with pytest.raises(BlockedHost):
            asyncio.run(fetch_public(client, "http://evil.example/"))
        assert len(client.calls) == 1

    def test_too_many_redirects_refused(self, monkeypatch):
        install_resolver(monkeypatch, {"loop.example": ["93.184.216.34"]})
        response = FakeResponse(302, {"Location": "https://loop.example/next"})
        client = FakeClient([response, response, response])
        with pytest.raises(BlockedHost):
            asyncio.run(fetch_public(client, "https://loop.example/", max_redirects=2))

    def test_non_http_scheme_refused(self, monkeypatch):
        client = FakeClient([FakeResponse(200)])
        with pytest.raises(BlockedHost):
            asyncio.run(fetch_public(client, "ftp://example.com/"))
        assert client.calls == []

    def test_disallowed_port_refused(self, monkeypatch):
        client = FakeClient([FakeResponse(200)])
        with pytest.raises(BlockedHost):
            asyncio.run(fetch_public(client, "http://example.com:22/"))
        assert client.calls == []

    def test_public_page_returned(self, monkeypatch):
        install_resolver(monkeypatch, {"good.example": ["93.184.216.34"]})
        response = FakeResponse(200, {"Content-Type": "text/html"})
        client = FakeClient([response])
        result = asyncio.run(fetch_public(client, "https://good.example/"))
        assert result is response
        assert client.calls[0]["follow_redirects"] is False
