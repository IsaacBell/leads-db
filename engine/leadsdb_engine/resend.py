"""Lightweight sync Resend client for the LeadsDB outreach engine.

Mirrors the pattern from apps/keyword-report/resend_client.py: POST to
https://api.resend.com/emails with RESEND_API_KEY.  Uses httpx (not requests)
to stay consistent with the rest of the engine.

PII guard: never log recipient addresses or full body content at info level.
"""

from __future__ import annotations

import os

import httpx

RESEND_ENDPOINT = "https://api.resend.com/emails"
REQUEST_TIMEOUT_SECONDS = 60


class ResendError(RuntimeError):
    """Raised when Resend does not accept an email or the API key is missing."""


def send_email(
    *,
    to: str,
    subject: str,
    text: str,
    from_addr: str | None = None,
) -> str:
    """Send a plain-text email via Resend and return the message id.

    Parameters
    ----------
    to : str
        Recipient email address.
    subject : str
        Email subject line.
    text : str
        Plain-text body.
    from_addr : str | None
        Sender address.  Defaults to RESEND_FROM_ADDRESS from the environment,
        or 'LeadsDB <outreach@leadsdb.news>'.  Must be a verified domain in
        the Resend account.

    Returns
    -------
    str
        The ``id`` field from the Resend API response (the message id).

    Raises
    ------
    ResendError
        If the API key is missing, the request fails, or the response is
        non-2xx.
    """
    api_key = os.environ.get("RESEND_API_KEY")
    if not api_key:
        raise ResendError(
            "RESEND_API_KEY is not set. Cannot send email."
        )

    if from_addr is None:
        from_addr = os.environ.get(
            "RESEND_FROM_ADDRESS",
            "LeadsDB <outreach@leadsdb.news>",
        )

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    payload = {
        "from": from_addr,
        "to": [to],
        "subject": subject,
        "text": text,
    }

    try:
        response = httpx.post(
            RESEND_ENDPOINT,
            headers=headers,
            json=payload,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
    except httpx.RequestError as exc:
        raise ResendError(f"Resend request failed: {exc}") from exc

    if not response.is_success:
        raise ResendError(
            f"Resend returned HTTP {response.status_code}: "
            f"{response.text[:500]}"
        )

    body = response.json()
    message_id: str = body.get("id", "")
    return message_id
