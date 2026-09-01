"""Domain validation and normalization utilities shared across processors."""


def normalize_domain(raw_domain: str) -> str | None:
    """Lowercase, strip, validate a domain name.

    Returns None for IP addresses, wildcards, or obviously invalid values.
    Used by all processors that handle domain strings from any source.
    """
    domain = raw_domain.strip().lower()
    if not domain:
        return None

    # Skip IP addresses (both IPv4 and IPv6)
    if domain.replace(".", "").isdigit():
        return None
    if ":" in domain and all(c in "0123456789abcdef:" for c in domain.replace("[]", "")):
        return None

    # Strip wildcard prefix — we want the base domain
    domain = domain.removeprefix("*.")

    # Must contain at least one dot
    if "." not in domain:
        return None

    return domain
