"""AES-GCM encryption for secret settings values.

user-supplied keys (BYOK: model inference API keys, outreach
delivery keys, etc.) are encrypted at rest in the `settings` table.

the master key is LDB_SETTINGS_ENCRYPTION_KEY: a urlsafe-base64-encoded 32-byte key, injected
via Infisical.

Ciphertext layout: `nonce(12 bytes) || ciphertext+tag` (AES-GCM, 256-bit key).
"""

from __future__ import annotations

import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

MASTER_KEY_ENV = "LDB_SETTINGS_ENCRYPTION_KEY"
_NONCE_BYTES = 12
_KEY_BYTES = 32

class CryptoError(RuntimeError):
    """Raised when the master key is missing/malformed or ciphertext is invalid."""

def _master_key() -> bytes | None:
    """Return the 32-byte master key, or None if the env var is unset.

    Raises CryptoError if the env var is present but malformed (loud failure on
    a real misconfiguration; silent "not configured" only when truly unset).
    """
    raw = os.environ.get(MASTER_KEY_ENV)
    if not raw:
        return None
    try:
        key = base64.urlsafe_b64decode(raw)
    except (ValueError, TypeError) as exc:
        raise CryptoError(f"{MASTER_KEY_ENV} is not valid base64: {exc}") from exc
    if len(key) != _KEY_BYTES:
        raise CryptoError(
            f"{MASTER_KEY_ENV} must decode to {_KEY_BYTES} bytes, got {len(key)}. " +
            "Generate one with: python -c \"import secrets,base64;print(base64.urlsafe_b64encode(secrets.token_bytes(32)).decode())\""
        )
    return key


def is_available() -> bool:
    """True when a usable master key is present (never raises)."""
    try:
        return _master_key() is not None
    except CryptoError:
        return False


def encrypt(plaintext: str) -> bytes:
    """Encrypt a UTF-8 string to `nonce || ciphertext+tag` bytes via AES-GCM."""
    key = _master_key()
    if key is None:
        raise CryptoError(
            f"cannot encrypt — {MASTER_KEY_ENV} is not set. " +
            "Generate one with: python -c \"import secrets,base64;print(base64.urlsafe_b64encode(secrets.token_bytes(32)).decode())\""
        )
    nonce = os.urandom(_NONCE_BYTES)
    ct = AESGCM(key).encrypt(nonce, plaintext.encode("utf-8"), None)
    return nonce + ct


def decrypt(token: bytes | bytearray | memoryview) -> str:
    """Decrypt a value produced by `encrypt()` back to a UTF-8 string."""
    if not isinstance(token, (bytes, bytearray, memoryview)):
        raise CryptoError("ciphertext must be bytes")
    token = bytes(token)
    if len(token) < _NONCE_BYTES + 16:  # nonce + minimum 16-byte GCM tag
        raise CryptoError("ciphertext too short or malformed")
    key = _master_key()
    if key is None:
        raise CryptoError(
            f"cannot decrypt — {MASTER_KEY_ENV} is not set but an encrypted " +
            "secret exists in the settings table. Set the key to read it, or clear " +
            "the secret row to idle the dependent processor."
        )
    nonce, ct = token[:_NONCE_BYTES], token[_NONCE_BYTES:]
    try:
        return AESGCM(key).decrypt(nonce, ct, None).decode("utf-8")
    except Exception as exc:  # InvalidTag / wrong key / corrupted data
        raise CryptoError(
            f"decryption failed (wrong master key or corrupted ciphertext): {exc}"
        ) from exc
