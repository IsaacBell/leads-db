import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { UPSERT_SECRET } from "@/src/lib/settings-queries";
import { encrypt } from "@/src/lib/crypto";

const pool = new Pool({ connectionString: process.env.LDB_DATABASE_URL });

export const dynamic = "force-dynamic";

// ---- Admin token gate ----

const ADMIN_TOKEN_ENV = "LEADSDB_ADMIN_TOKEN";

function checkAdmin(request: NextRequest): NextResponse | null {
  const token = request.headers.get("x-admin-token") || request.cookies.get("admin_token")?.value;
  const expected = process.env[ADMIN_TOKEN_ENV];
  if (!expected) {
    return null;
  }
  if (!token || token !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/**
 * POST /api/v1/settings/secrets — set or clear an encrypted secret.
 *
 * Body: { key: string, value: string|null, label?, description?, category? }
 *
 * - value = string -> encrypts with AES-GCM, stores ciphertext
 * - value = null (or empty string) -> clears the secret (sets encrypted_value = NULL)
 *
 * Never logs or echoes the plaintext value.
 */
export async function POST(request: NextRequest) {
  const authErr = checkAdmin(request);
  if (authErr) return authErr;

  try {
    const body = await request.json();
    const { key, value, label, description, category } = body;

    if (!key) {
      return NextResponse.json(
        { error: "key is required" },
        { status: 400 },
      );
    }

    // Encrypt the value if non-empty; null/empty string means clear the secret
    let encryptedValue: Buffer | null = null;
    if (value && typeof value === "string" && value.length > 0) {
      encryptedValue = encrypt(value);
    }

    await pool.query(UPSERT_SECRET, [
      key,
      encryptedValue,
      label ?? null,
      description ?? null,
      category ?? null,
    ]);

    return NextResponse.json({
      success: true,
      key,
      status: encryptedValue ? "encrypted" : "cleared",
    });
  } catch (error) {
    // Intentionally NOT logging the body to avoid exposing the secret
    console.error("Secrets POST failed:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json(
      { error: "Failed to set secret" },
      { status: 500 },
    );
  }
}
