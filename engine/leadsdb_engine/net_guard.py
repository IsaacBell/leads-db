"""Guard outbound HTTP fetches against server-side request forgery.

A domain pulled from a public source can point at a loopback, private,
link-local or cloud-metadata address. Every address a host resolves to is
checked before a request goes out, and redirects are followed by hand so
each hop is checked the same way.
"""

import asyncio
import ipaddress
import socket
import urllib.parse

import httpx

ALLOWED_SCHEMES = frozenset({"http", "https"})
ALLOWED_PORTS = frozenset({80, 443})


class BlockedHost(ValueError):
    """Raised when a host or URL is not safe to fetch."""


def is_public_address(address: str) -> bool:
    """Return True only for a globally reachable IP address.

    A link-local zone id after ``%`` is dropped, and an IPv4 address written
    inside IPv6 (``::ffff:127.0.0.1``) is unwrapped before the check.
    """
    text = address.split("%", 1)[0]
    try:
        ip = ipaddress.ip_address(text)
    except ValueError:
        return False
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped is not None:
        ip = ip.ipv4_mapped
    return ip.is_global


async def assert_public_host(host: str, port: int) -> None:
    """Resolve ``host`` and raise BlockedHost unless every answer is public."""
    if not host:
        raise BlockedHost("no host to resolve")
    try:
        infos = await asyncio.get_running_loop().getaddrinfo(
            host, port, type=socket.SOCK_STREAM
        )
    except OSError as exc:
        raise BlockedHost(f"could not resolve host: {host}") from exc
    if not infos:
        raise BlockedHost(f"host did not resolve: {host}")
    for info in infos:
        address = info[4][0]
        if not is_public_address(address):
            raise BlockedHost(f"host resolves to a non-public address: {address}")


async def fetch_public(
    client: httpx.AsyncClient,
    url: str,
    *,
    max_redirects: int = 3,
    **kwargs,
) -> httpx.Response:
    """GET ``url`` after checking the scheme, port and resolved addresses.

    Redirects are followed by hand up to ``max_redirects`` hops; each
    ``Location`` is checked before it is requested. Raises BlockedHost when a
    hop is not safe, or when the redirect limit is exceeded.
    """
    for _ in range(max_redirects + 1):
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme not in ALLOWED_SCHEMES:
            raise BlockedHost(f"scheme not allowed: {parsed.scheme!r}")
        if not parsed.hostname:
            raise BlockedHost("no host in url")
        try:
            port = parsed.port
        except ValueError as exc:
            raise BlockedHost("invalid port in url") from exc
        if port is None:
            port = 443 if parsed.scheme == "https" else 80
        elif port not in ALLOWED_PORTS:
            raise BlockedHost(f"port not allowed: {port}")

        await assert_public_host(parsed.hostname, port)

        response = await client.get(url, follow_redirects=False, **kwargs)
        if response.is_redirect:
            location = response.headers.get("Location")
            if location:
                url = urllib.parse.urljoin(url, location)
                continue
        return response

    raise BlockedHost("too many redirects")
