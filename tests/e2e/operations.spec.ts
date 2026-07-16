import { expect, test } from "@playwright/test";

test("health and monitoring endpoints enforce their production contracts", async ({ request }) => {
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({ status: "ok", database: "available" });
  expect(health.headers()["cache-control"]).toContain("no-store");

  const unauthorized = await request.get("/api/metrics");
  expect(unauthorized.status()).toBe(401);
  expect(unauthorized.headers()["cache-control"]).toContain("no-store");

  const authorized = await request.get("/api/metrics", { headers: { authorization: "Bearer synthetic-e2e-monitoring-token-with-32-characters" } });
  expect(authorized.status()).toBe(200);
  const metrics = await authorized.text();
  for (const name of ["hapb_organizations", "hapb_jobs_pending", "hapb_jobs_failed", "hapb_jobs_stale", "hapb_submissions_failed", "hapb_documents_failed", "hapb_last_backup_age_seconds"]) expect(metrics).toContain(name);
  expect(metrics).not.toContain("example.org");
});
