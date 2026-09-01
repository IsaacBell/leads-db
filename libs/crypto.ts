import crypto from "node:crypto";

/**
 * AES-256-GCM encryption for secret settings values.
 *
 *
 * Ciphertext layout: `nonce(12 bytes) || ciphertext+tag` (AES-GCM, 256-bit key).
 *
 * This implementation MUST interop with the Python `leadsdb_engine.crypto`
 * module (AESGCM from `cryptography`). Both produce/consume:
 *   nonce(12) || ciphertext+tag
 * where the GCM tag is appended at the end of the ciphertext by Node's
 * `crypto.createCipheriv` (via `getAuthTag()`) and by Python's `AESGCM.encrypt`.
 */

const ALGORITHM = "aes-256-gcm";
const NONCE_BYTES = 12;
const KEY_BYTES = 32;
const MASTER_KEY_ENV = "LDB_SETTINGS_ENCRYPTION_KEY";

export class CryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CryptoError";
  }
}

/**
 * Return the 32-byte master key, or null if no env var
 * Raise CryptoError if the env var is malformed.
 */
const masterKey = (): Buffer | null => {
  const raw = process.env[MASTER_KEY_ENV];
  if (!raw) return null;

  let key: Buffer;
  try {
    key = Buffer.from(raw, "base64url");
  } catch {
    throw new CryptoError(
      `${MASTER_KEY_ENV} is not valid base64url`,
    );
  }

  if (key.length !== KEY_BYTES) {
    throw new CryptoError(
      `${MASTER_KEY_ENV} must decode to ${KEY_BYTES} bytes, got ${key.length}. ` +
      'Generate one with: python -c "import secrets,base64;print(base64.urlsafe_b64encode(secrets.token_bytes(32)).decode())"',
    );
  }

  return key;
}

/**
 * Is a usable master key present?
 */
export const isAvailable = (): boolean => {
  try {
    return masterKey() !== null;
  } catch {
    return false;
  }
}

/**
 * Encrypt a UTF-8 string to `nonce || ciphertext+tag` bytes via AES-GCM.
 */
export function encrypt(plaintext: string): Buffer {
  const key = masterKey();
  if (!key) {
    throw new CryptoError(
      `cannot encrypt — ${MASTER_KEY_ENV} is not set. ` +
      'Generate one with: python -c "import secrets,base64;print(base64.urlsafe_b64encode(secrets.token_bytes(32)).decode())"',
    );
  }

  const nonce = crypto.randomBytes(NONCE_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, nonce);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf-8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]);

  return Buffer.concat([nonce, encrypted]);
}

/**
 * Decrypt a value produced by `encrypt()` back to a UTF-8 string.
 */
export function decrypt(token: Buffer): string {
  if (!Buffer.isBuffer(token)) {
    throw new CryptoError("ciphertext must be a Buffer");
  }

  if (token.length < NONCE_BYTES + 16) {
    throw new CryptoError("ciphertext too short or malformed");
  }

  const key = masterKey();
  if (!key) {
    throw new CryptoError(
      `cannot decrypt — ${MASTER_KEY_ENV} is not set but an encrypted ` +
      "secret exists in the settings table. Set the key to read it, or clear " +
      "the secret row to idle the dependent processor.",
    );
  }

  const nonce = token.subarray(0, NONCE_BYTES);
  const ctWithTag = token.subarray(NONCE_BYTES);

  // The last 16 bytes are the GCM auth tag
  const tag = ctWithTag.subarray(ctWithTag.length - 16);
  const ct = ctWithTag.subarray(0, ctWithTag.length - 16);

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, key, nonce);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([
      decipher.update(ct),
      decipher.final(),
    ]);
    return decrypted.toString("utf-8");
  } catch (err) {
    throw new CryptoError(
      `decryption failed (wrong master key or corrupted ciphertext): ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
