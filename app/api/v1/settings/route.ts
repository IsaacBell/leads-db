import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import {
  GET_ALL_SETTINGS,
  UPSERT_SETTING,
} from "@/libs/settings-queries";

const pool = new Pool({ connectionString: process.env.LDB_DATABASE_URL });

export const dynamic = "force-dynamic";

// ---- Admin token gate ----

const ADMIN_TOKEN_ENV = "LEADSDB_ADMIN_TOKEN";

function checkAdmin(request: NextRequest): NextResponse | null {
  const token = request.headers.get("x-admin-token") || request.cookies.get("admin_token")?.value;
  const expected = process.env[ADMIN_TOKEN_ENV];
  if (!expected) {
    // No admin token configured — allow in dev, warn via return
    return null;
  }
  if (!token || token !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

// ---- Helpers ----

function maskSecret(value: string | null): string | null {
  if (!value) return null;
  if (value.length <= 12) return "****";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

/**
 * Normalize a settings row into a response object.
 * Secret values are masked unless explicitly revealed.
 */
function rowToSetting(row: Record<string, unknown>, reveal = false): Record<string, unknown> {
  const out: Record<string, unknown> = {
    key: row.key,
    int_value: row.int_value ?? null,
    text_value: row.text_value ?? null,
    float_value: row.float_value ?? null,
    bool_value: row.bool_value ?? null,
    is_secret: Boolean(row.is_secret),
    label: row.label ?? null,
    description: row.description ?? null,
    category: row.category ?? null,
  };

  if (out.is_secret) {
    const encryptedBuf = row.encrypted_value
      ? (row.encrypted_value instanceof Buffer ? row.encrypted_value : null)
      : null;
    if (reveal && encryptedBuf) {
      // We don't decrypt on the GET path — secrets are write-only via the secrets endpoint
      // We just show masked status
      out.value_status = "set";
    } else if (encryptedBuf) {
      out.value_status = "set";
    } else {
      out.value_status = "not_set";
    }
    // Never echo the secret value on GET
    out.secret_value = undefined;
    out.encrypted_value = undefined;
  }

  return out;
}

function inferTypedValue(value: unknown): {
  int_value: number | null;
  float_value: number | null;
  text_value: string | null;
  bool_value: boolean | null;
} {
  let int_value: number | null = null;
  let float_value: number | null = null;
  let text_value: string | null = null;
  let bool_value: boolean | null = null;

  if (typeof value === "boolean") {
    bool_value = value;
  } else if (typeof value === "number") {
    if (Number.isInteger(value)) {
      int_value = value;
    } else {
      float_value = value;
    }
  } else if (typeof value === "string") {
    const lower = value.toLowerCase();
    if (lower === "true") {
      bool_value = true;
    } else if (lower === "false") {
      bool_value = false;
    } else {
      // Try parsing as number
      const num = Number(value);
      if (!Number.isNaN(num) && value.trim() !== "") {
        if (Number.isInteger(num)) {
          int_value = num;
        } else {
          float_value = num;
        }
      } else {
        text_value = value;
      }
    }
  }

  return { int_value, float_value, text_value, bool_value };
}

// ---- Routes ----

/**
 * GET /api/v1/settings — list all settings, grouped by category.
 * Secret values are masked (show "set" / "not_set" status only).
 */
export async function GET(request: NextRequest) {
  const authErr = checkAdmin(request);
  if (authErr) return authErr;

  try {
    const result = await pool.query(GET_ALL_SETTINGS);
    const rows = result.rows.map((r) => rowToSetting(r));

    // Group by category
    const grouped: Record<string, Record<string, unknown>[]> = {};
    for (const row of rows) {
      const cat = (row.category as string) || "uncategorized";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(row);
    }

    return NextResponse.json({ settings: grouped });
  } catch (error) {
    console.error("Settings GET failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/v1/settings — set a plain (non-secret) setting.
 *
 * Body: { key: string, value: string|number|boolean, label?, description?, category? }
 *
 * Infers the typed column from the value shape.
 */
export async function POST(request: NextRequest) {
  const authErr = checkAdmin(request);
  if (authErr) return authErr;

  try {
    const body = await request.json();
    const { key, value, label, description, category } = body;

    if (!key || value === undefined) {
      return NextResponse.json(
        { error: "key and value are required" },
        { status: 400 },
      );
    }

    const typed = inferTypedValue(value);

    await pool.query(UPSERT_SETTING, [
      key,
      typed.int_value,
      typed.text_value,
      typed.float_value,
      typed.bool_value,
      label ?? null,
      description ?? null,
      category ?? null,
    ]);

    return NextResponse.json({ success: true, key });
  } catch (error) {
    console.error("Settings POST failed:", error);
    return NextResponse.json(
      { error: "Failed to set setting" },
      { status: 500 },
    );
  }
}
