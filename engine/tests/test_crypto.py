"""Tests for the AES-GCM settings encryption layer.

Validates encrypt/decrypt round-trips, the idle-without-key posture, and the
error surface for misconfiguration — no network, no DB.
"""

from __future__ import annotations

import base64
import secrets

import pytest

from leadsdb_engine import crypto


@pytest.fixture
def master_key(monkeypatch):
    """Set a valid 32-byte urlsafe-base64 master key for the duration of a test."""
    key = base64.urlsafe_b64encode(secrets.token_bytes(32)).decode()
    monkeypatch.setenv(crypto.MASTER_KEY_ENV, key)
    yield key
    monkeypatch.delenv(crypto.MASTER_KEY_ENV, raising=False)


@pytest.fixture
def no_key(monkeypatch):
    """Ensure the master key env var is absent."""
    monkeypatch.delenv(crypto.MASTER_KEY_ENV, raising=False)


class TestAvailability:
    def test_is_available_when_key_set(self, master_key):
        assert crypto.is_available() is True

    def test_not_available_when_key_unset(self, no_key):
        assert crypto.is_available() is False

    def test_not_available_when_key_malformed(self, monkeypatch):
        monkeypatch.setenv(crypto.MASTER_KEY_ENV, "not-base64-!!!")
        assert crypto.is_available() is False


class TestRoundTrip:
    def test_encrypt_then_decrypt(self, master_key):
        plaintext = "sk-deepinfra-abc123-rev4"
        token = crypto.encrypt(plaintext)
        assert isinstance(token, bytes)
        assert token != plaintext.encode()
        assert crypto.decrypt(token) == plaintext

    def test_empty_string_round_trips(self, master_key):
        assert crypto.decrypt(crypto.encrypt("")) == ""

    def test_unicode_round_trips(self, master_key):
        s = "key-with-emoji-🔑-and-text"
        assert crypto.decrypt(crypto.encrypt(s)) == s


class TestErrorSurface:
    def test_encrypt_without_key_raises(self, no_key):
        with pytest.raises(crypto.CryptoError, match="not set"):
            crypto.encrypt("secret")

    def test_decrypt_without_key_raises(self, no_key):
        # A token that looks structurally valid but cannot be decrypted without the key.
        fake_token = b"\x00" * 28  # 12-byte nonce + 16-byte tag minimum
        with pytest.raises(crypto.CryptoError, match="not set"):
            crypto.decrypt(fake_token)

    def test_decrypt_with_wrong_key_raises(self, monkeypatch):
        key1 = base64.urlsafe_b64encode(secrets.token_bytes(32)).decode()
        key2 = base64.urlsafe_b64encode(secrets.token_bytes(32)).decode()
        monkeypatch.setenv(crypto.MASTER_KEY_ENV, key1)
        token = crypto.encrypt("secret")
        monkeypatch.setenv(crypto.MASTER_KEY_ENV, key2)
        with pytest.raises(crypto.CryptoError, match="decryption failed"):
            crypto.decrypt(token)

    def test_decrypt_garbage_raises(self, master_key):
        with pytest.raises(crypto.CryptoError):
            crypto.decrypt(b"not-a-valid-token")

    def test_decrypt_rejects_non_bytes(self, master_key):
        with pytest.raises(crypto.CryptoError, match="must be bytes"):
            crypto.decrypt("string-not-bytes")

    def test_malformed_key_length_raises(self, monkeypatch):
        # 16 bytes instead of 32 — base64-encodes fine but is the wrong size.
        short_key = base64.urlsafe_b64encode(secrets.token_bytes(16)).decode()
        monkeypatch.setenv(crypto.MASTER_KEY_ENV, short_key)
        with pytest.raises(crypto.CryptoError, match="32 bytes"):
            crypto.encrypt("test")


class TestNonceUniqueness:
    """Each encrypt call must produce a fresh nonce — no IV reuse under AES-GCM."""

    def test_two_encryptions_produce_different_ciphertexts(self, master_key):
        plaintext = "same-secret"
        t1 = crypto.encrypt(plaintext)
        t2 = crypto.encrypt(plaintext)
        assert t1 != t2  # different nonces → different ciphertexts
        assert crypto.decrypt(t1) == crypto.decrypt(t2) == plaintext
