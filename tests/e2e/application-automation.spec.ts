import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test("Jordan Rivera application is completed, generated, bundled, and approved", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Caseworker" }).click();
  await page.getByRole("link", { name: "Continue Jordan Rivera application" }).click();
  await expect(page.getByRole("heading", { name: "Family Pathways Housing Application" })).toBeVisible();
  await expect(page.getByText("32", { exact: true }).first()).toBeVisible();
  await page.getByRole("link", { name: "Complete remaining questions" }).click();

  await expect(page.getByRole("heading", { name: "Date of birth" })).toBeVisible();
  await page.getByLabel("Date of birth").fill("1990-05-08");
  await page.getByRole("button", { name: "Save and continue" }).click();

  await expect(page.getByRole("heading", { name: "Current mailing address" })).toBeVisible();
  await page.getByLabel("Current mailing address").fill("128 Harbor Avenue, Riverton, NY 10004");
  await page.getByRole("button", { name: "Save and continue" }).click();

  await expect(page.getByRole("heading", { name: "Preferred contact method" })).toBeVisible();
  await page.getByLabel("Preferred contact method").selectOption("Phone");
  await page.getByRole("button", { name: "Save and continue" }).click();

  await expect(page.getByRole("heading", { name: "Emergency contact" })).toBeVisible();
  await page.getByLabel("Emergency contact").fill("Elena Rivera, sister, (555) 014-2299");
  await page.getByRole("button", { name: "Save and continue" }).click();

  await expect(page.getByRole("heading", { name: "Identification expiration date" })).toBeVisible();
  await page.getByLabel("Identification expiration date").fill("2028-04-30");
  await page.getByRole("button", { name: "Save and continue" }).click();

  await expect(page.getByRole("heading", { name: "Applicant consent confirmed" })).toBeVisible();
  await page.getByRole("checkbox", { name: /Yes, confirmed/ }).check();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page.getByRole("heading", { name: "Remaining questions are complete" })).toBeVisible();
  await page.getByRole("link", { name: "Review full application" }).click();

  await page.getByLabel("Applicant’s typed legal name").fill("Jordan Rivera");
  await page.getByLabel(/I certify that the information/).check();
  await page.getByLabel(/I consent to the listed supporting documents/).check();
  await page.getByRole("button", { name: "Sign and record consent" }).click();
  await expect(page.getByText("Signed electronically by Jordan Rivera")).toBeVisible();
  await page.getByRole("button", { name: "Generate application" }).click();
  await expect(page.getByText(/Completed application version 1 generated successfully/)).toBeVisible();
  const applicationDownload = page.waitForEvent("download");
  await page.getByRole("link", { name: "Completed application" }).click();
  const completedApplication = await applicationDownload; expect(completedApplication.suggestedFilename()).toBe("family-pathways-application-jordan-rivera-v1.pdf");
  await mkdir("output/pdf", { recursive: true }); await completedApplication.saveAs("output/pdf/family-pathways-application-jordan-rivera-v1.pdf");
  const packetDownload = page.waitForEvent("download");
  await page.getByRole("link", { name: "Supporting packet" }).click();
  const supportingPacket = await packetDownload; expect(supportingPacket.suggestedFilename()).toBe("family-pathways-application-jordan-rivera-v1-supporting-packet.pdf");
  await supportingPacket.saveAs("output/pdf/family-pathways-application-jordan-rivera-v1-supporting-packet.pdf");
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByText("Submitted for review", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /Sign out/ }).click();
  await page.getByRole("button", { name: "Reviewer" }).click();
  await page.getByRole("link", { name: /Open review queue/ }).click();
  const applicationSection = page.locator("section").filter({ has: page.getByRole("heading", { name: "Completed housing applications" }) });
  await applicationSection.getByRole("link", { name: /Jordan Rivera/ }).click();
  await page.getByRole("button", { name: "Approve application" }).click();
  await expect(page.getByText("Approved", { exact: true }).first()).toBeVisible();
});
