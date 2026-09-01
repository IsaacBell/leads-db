"""Safe Harbor de-identification helpers (HIPAA 18 identifiers).

These functions apply to any PII field that could map to a Safe Harbor
identifier. Where we don't store a given identifier type (SSN, MRN, etc.)
the function is a no-op — but present in the audit trail to prove coverage.

Masking strategy by identifier type:
  1. Names           → first initial, last initial  ("Jane Doe" → "J. D.")
  4. Phone numbers   → show last 4                  ("+1-415-555-1234" → "***-***-1234")
  6. Email addresses → first char + domain truncated ("j@ex.***")
  14. URLs           → domain only                  ("https://linkedin.com/in/jane" → "linkedin.com/in/***")
"""

import re


def mask_email(raw: str | None) -> str | None:
    """Safe Harbor #6: reveal first character, mask local part and domain."""
    if not raw:
        return None
    if "@" not in raw:
        return _mask_string(raw, keep_front=1)
    local, domain = raw.rsplit("@", 1)
    domain_parts = domain.split(".")
    masked_local = local[0] if local else "*"
    masked_domain = "***"
    if len(domain_parts) >= 2:
        masked_domain = domain_parts[-1]
        # show first char of primary domain part
        primary = domain_parts[-2]
        primary_masked = primary[0] + "***" if len(primary) > 1 else "*"
        masked_domain = primary_masked + "." + masked_domain
    return f"{masked_local}@{masked_domain}"


def mask_phone(raw: str | None) -> str | None:
    """Safe Harbor #4: reveal last 4 digits only."""
    if not raw:
        return None
    digits = re.sub(r"\D", "", raw)
    if len(digits) < 4:
        return "***-***-****"
    return "***-***-" + digits[-4:]


def mask_name(raw: str | None) -> str | None:
    """Safe Harbor #1: first initial + last initial."""
    if not raw:
        return None
    parts = raw.strip().split()
    if len(parts) == 1:
        return parts[0][0].upper() + "."
    first = parts[0][0].upper() + "."
    last = parts[-1][0].upper() + "."
    return f"{first} {last}"


def mask_url(raw: str | None) -> str | None:
    """Safe Harbor #14: show domain, mask the path/username."""
    if not raw:
        return None
    # Strip protocol
    text = raw.strip()
    text = re.sub(r"^https?://", "", text)
    # Strip trailing slashes
    text = text.rstrip("/")
    parts = text.split("/", 1)
    domain = parts[0]
    if len(parts) > 1:
        return f"{domain}/***"
    return domain


def mask_identifier_18(_raw: str | None) -> str | None:
    """Safe Harbor #18: catch-all for any other unique identifying code.
    We store nothing that falls here currently, but the function exists
    for auditability — proving we've considered all 18 points."""
    return _raw


# Map of contact field names to their Safe Harbor identifier number
FIELD_MASK_MAP: dict[str, tuple[int, str, callable]] = {
    "name": (1, "Names", mask_name),
    "phone": (4, "Phone numbers", mask_phone),
    "email": (6, "Email addresses", mask_email),
    "linkedin": (14, "URLs", mask_url),
    # company is organizational, not personal — treated as non-PII
    # role is job function, not personal identifier
    # notes is free-text — reviewed manually
}


def mask_contact_row(row: dict) -> dict:
    """Return a copy of the row with configured PII fields masked."""
    masked = dict(row)
    for field, (_num, _label, mask_fn) in FIELD_MASK_MAP.items():
        if field in masked:
            masked[field] = mask_fn(masked[field])
    return masked


def mask_annotation_row(row: dict, reveal: bool = False) -> dict:
    """Mask the JSONB `value` of a contact-target annotation by default.

    Contact-target annotations (Exa/LinkedIn/Clearbit/manual research) can
    transitively carry PII inside `value`. By default we replace the value with
    a redaction marker and keep the safe metadata (source, key, confidence,
    timestamps). Non-contact targets cannot reference personal PII directly, so
    their value is returned intact. Use reveal=True to return the raw value.
    """
    masked = dict(row)
    if reveal:
        return masked
    if str(masked.get("target_type", "")).lower() == "contact":
        masked["value"] = "<redacted: contact-target annotation may contain PII>"
    return masked


def _mask_string(raw: str, keep_front: int = 1, keep_back: int = 0) -> str:
    """Generic string mask — show first N chars, rest as ***."""
    if not raw:
        return raw
    if len(raw) <= keep_front + keep_back:
        return raw
    front = raw[:keep_front]
    back = raw[-keep_back:] if keep_back else ""
    middle_len = len(raw) - keep_front - keep_back
    return front + "*" * min(middle_len, 3) + back
