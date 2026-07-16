import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function expectNoAccessibilityViolations(page: Page) {
  await expect(page).toHaveTitle(/Housing Packet Builder/);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).exclude("[data-next-badge-root]").analyze();
  expect(results.violations, results.violations.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
}

test("core caseworker workflow meets automated WCAG AA checks", async ({ page }) => {
  await page.goto("/"); await expectNoAccessibilityViolations(page);
  await page.getByRole("button", { name: "Caseworker" }).click(); await expectNoAccessibilityViolations(page);
  await page.getByRole("link", { name: "Continue Jordan Rivera application" }).click(); await expectNoAccessibilityViolations(page);
  await page.getByRole("link", { name: "Complete remaining questions" }).click(); await expectNoAccessibilityViolations(page);
});

test("administrator template and staff security pages meet automated WCAG AA checks", async ({ page }) => {
  await page.goto("/"); await page.getByRole("button", { name: "Administrator" }).click();
  await page.getByRole("link", { name: "Programs" }).click(); await expectNoAccessibilityViolations(page);
  await page.getByRole("link", { name: /Family Pathways Rapid Rehousing/ }).click(); await expectNoAccessibilityViolations(page);
  await page.getByRole("link", { name: /Family Pathways Agency AcroForm/ }).click(); await expectNoAccessibilityViolations(page);
  await page.getByRole("link", { name: "Staff access" }).click(); await expectNoAccessibilityViolations(page);
  await page.getByRole("link", { name: "Account security" }).click(); await expectNoAccessibilityViolations(page);
});
