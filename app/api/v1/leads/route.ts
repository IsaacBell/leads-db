import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.LDB_DATABASE_URL });

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await pool.query(
      `SELECT
        de.registrable_domain,
        de.san_entries,
        de.not_before,
        de.first_seen_at,
        dc.dns_resolves,
        dc.http_status,
        dc.page_title,
        dc.has_business_content,
        dc.has_pricing,
        dc.has_team_page,
        dc.has_about_page,
        dc.has_contact_page,
        dc.is_parked,
        dc.llm_score,
        dc.llm_reasoning,
        dc.classified_at
      FROM domain_events de
      JOIN domain_classifications dc ON dc.domain_event_id = de.id
      WHERE dc.has_business_content = true
        AND dc.is_parked = false
      ORDER BY dc.llm_score DESC NULLS LAST, de.first_seen_at DESC
      LIMIT 50`,
    );

    return NextResponse.json({ leads: result.rows });
  } catch (error) {
    console.error("DB query failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch leads" },
      { status: 500 },
    );
  }
}
