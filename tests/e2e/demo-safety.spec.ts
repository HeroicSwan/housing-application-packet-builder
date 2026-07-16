import { expect, test } from "@playwright/test";

test("synthetic warning persists on authentication and application screens at mobile width", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/");
  const warning = page.getByRole("status", { name: "Synthetic demonstration environment warning" });
  await expect(warning).toBeVisible();
  await expect(warning).toContainText("Do not enter real applicant information");

  await page.getByRole("button", { name: "Caseworker" }).click();
  await expect(page.getByText("Caseworker workspace")).toBeVisible();
  await expect(warning).toBeVisible();
});
