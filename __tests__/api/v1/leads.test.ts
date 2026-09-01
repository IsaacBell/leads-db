import { describe, it, expect } from "vitest";

/**
 * Regression tests for the /api/v1/leads route handler.
 *
 * These run without a real database by relying on the route's error path:
 * when LDB_DATABASE_URL is unset, pg Pool construction will fail and the
 * handler returns a 500. This validates the handler's error handling path.
 *
 * Full integration tests require a running Postgres instance with the
 * leads-db schema — see docker-compose.yml for that setup.
 */

describe("GET /api/v1/leads", () => {
  it("should export GET function", async () => {
    const mod = await import("@/app/api/v1/leads/route");
    expect(mod.GET).toBeDefined();
    expect(typeof mod.GET).toBe("function");
  });

  it("should return 500 when DATABASE_URL is unset", async () => {
    // Unset the env var so the Pool construction fails
    const orig = process.env.LDB_DATABASE_URL;
    delete process.env.LDB_DATABASE_URL;

    const mod = await import("@/app/api/v1/leads/route");
    const response = await mod.GET();
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body).toHaveProperty("error");
    expect(body.error).toContain("Failed");

    // Restore
    if (orig) process.env.LDB_DATABASE_URL = orig;
  });
});
