import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("administrator setup is resumable, redacts secrets, and runs a real synthetic storage round trip", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Administrator" }).click();
  await page.getByRole("link", { name: "Organization setup" }).click();
  await expect(page.getByRole("heading", { name: "Identify the responsible nonprofit" })).toBeVisible();
  await page.getByLabel("Organization name").fill("Synthetic Harbor Services");
  await page.getByLabel("Jurisdiction").fill("Synthetic Test Jurisdiction");
  await page.getByLabel("Responsible contact").fill("Synthetic Privacy Contact");
  await page.getByLabel("Contact email").fill("privacy@example.test");
  await page.getByRole("button", { name: "Save and exit" }).click();
  await expect(page.getByText("Progress saved")).toBeVisible();
  await expect(page.getByLabel("Organization name")).toHaveValue("Synthetic Harbor Services");
  await page.reload();
  await expect(page.getByLabel("Jurisdiction")).toHaveValue("Synthetic Test Jurisdiction");

  await page.getByRole("link", { name: /Email, storage & scanning/ }).click();
  await page.getByLabel("SMTP password").fill("synthetic-e2e-secret-not-real");
  await page.getByRole("button", { name: "Save and exit" }).click();
  await expect(page.getByLabel("SMTP password")).toHaveValue("");
  await expect(page.getByLabel("SMTP password")).toHaveAttribute("placeholder", /Configured/);
  await expect(page.locator("body")).not.toContainText("synthetic-e2e-secret-not-real");
  await page.locator("form").filter({ hasText: "Run synthetic test" }).filter({ has: page.locator('input[name="kind"][value="storage"]') }).getByRole("button").click();
  await expect(page.getByText("STORAGE_ROUND_TRIP_OK")).toBeVisible();

  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).exclude("[data-next-badge-root]").analyze();
  expect(accessibility.violations, accessibility.violations.map((item) => item.help).join("\n")).toEqual([]);
});

test("ordinary staff cannot access organization setup", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Caseworker" }).click();
  await expect(page.getByText("Caseworker workspace")).toBeVisible();
  await page.goto("/admin/setup");
  await expect(page.getByRole("heading", { name: "This area is restricted" })).toBeVisible();
});

test("setup reflows without horizontal scrolling on a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Administrator" }).click();
  await expect(page.getByText("Administrator workspace")).toBeVisible();
  await page.goto("/admin/setup?step=organization");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await expect(page.getByRole("button", { name: "Save and continue" })).toBeVisible();
});
