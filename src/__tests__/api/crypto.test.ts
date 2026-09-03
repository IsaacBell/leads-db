import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";

const KEY_ENV = "LDB_SETTINGS_ENCRYPTION_KEY";

function setMasterKey(): string {
  const key = crypto.randomBytes(32).toString("base64url");
  process.env[KEY_ENV] = key;
  return key;
}

function unsetMasterKey(): void {
  delete process.env[KEY_ENV];
}

describe("libs/crypto", () => {
  beforeEach(() => {
    unsetMasterKey();
  });

  describe("isAvailable", () => {
    it("returns true when key is set", async () => {
      setMasterKey();
      const mod = await import("@/src/lib/crypto");
      expect(mod.isAvailable()).toBe(true);
    });

    it("returns false when key is unset", async () => {
      const mod = await import("@/src/lib/crypto");
      expect(mod.isAvailable()).toBe(false);
    });

    it("returns false when key is malformed (not base64url)", async () => {
      process.env[KEY_ENV] = "!!!not-base64!!!";
      const mod = await import("@/src/lib/crypto");
      expect(mod.isAvailable()).toBe(false);
    });

    it("returns false when key is wrong length", async () => {
      process.env[KEY_ENV] = Buffer.from("too-short").toString("base64url");
      const mod = await import("@/src/lib/crypto");
      expect(mod.isAvailable()).toBe(false);
    });
  });

  describe("round-trip", () => {
    it("encrypts then decrypts a string", async () => {
      setMasterKey();
      const mod = await import("@/src/lib/crypto");
      const plaintext = "sk-deepinfra-abc123-rev4";
      const token = mod.encrypt(plaintext);
      expect(token).toBeInstanceOf(Buffer);
      expect(token.toString("utf-8")).not.toBe(plaintext);
      expect(mod.decrypt(token)).toBe(plaintext);
    });

    it("round-trips an empty string", async () => {
      setMasterKey();
      const mod = await import("@/src/lib/crypto");
      expect(mod.decrypt(mod.encrypt(""))).toBe("");
    });

    it("round-trips unicode", async () => {
      setMasterKey();
      const mod = await import("@/src/lib/crypto");
      const s = "key-with-emoji-🔑-and-text-ñøø";
      expect(mod.decrypt(mod.encrypt(s))).toBe(s);
    });
  });

  describe("error surface", () => {
    it("encrypt without key throws", async () => {
      const mod = await import("@/src/lib/crypto");
      expect(() => mod.encrypt("secret")).toThrow("not set");
    });

    it("decrypt without key throws", async () => {
      const mod = await import("@/src/lib/crypto");
      const fakeToken = Buffer.alloc(28); // 12 nonce + 16 tag minimum
      expect(() => mod.decrypt(fakeToken)).toThrow("not set");
    });

    it("decrypt with wrong key throws", async () => {
      setMasterKey();
      const mod = await import("@/src/lib/crypto");
      const token = mod.encrypt("secret");
      unsetMasterKey();
      setMasterKey(); // different key
      expect(() => mod.decrypt(token)).toThrow("decryption failed");
    });

    it("decrypt garbage throws", async () => {
      setMasterKey();
      const mod = await import("@/src/lib/crypto");
      expect(() => mod.decrypt(Buffer.from("not-a-valid-token"))).toThrow();
    });

    it("decrypt rejects non-Buffer", async () => {
      setMasterKey();
      const mod = await import("@/src/lib/crypto");
      expect(() => mod.decrypt("string-not-buffer" as unknown as Buffer)).toThrow("must be a Buffer");
    });
  });

  describe("nonce uniqueness", () => {
    it("two encryptions of the same secret produce different ciphertexts", async () => {
      setMasterKey();
      const mod = await import("@/src/lib/crypto");
      const plaintext = "same-secret";
      const t1 = mod.encrypt(plaintext);
      const t2 = mod.encrypt(plaintext);
      expect(t1).not.toEqual(t2);
      expect(mod.decrypt(t1)).toBe(plaintext);
      expect(mod.decrypt(t2)).toBe(plaintext);
    });
  });
});
