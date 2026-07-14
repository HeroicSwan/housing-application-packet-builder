import { test, expect, type Page } from "@playwright/test";

function monitor(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test("caseworker and reviewer complete correction and approval lifecycle", async ({ page }) => {
  const browserErrors = monitor(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Caseworker" }).click();
  await expect(page.getByText("Caseworker workspace")).toBeVisible();
  await page.getByRole("link", { name: /Create a case/ }).click();
  await page.getByLabel("Legal name").fill("Jordan Lee");
  await page.getByRole("button", { name: "Create case" }).click();
  await expect(page.getByText("Jordan Lee").first()).toBeVisible();
  const caseUrl = page.url();

  await page.getByRole("link", { name: "Client profile", exact: true }).click();
  await page.getByLabel("Preferred name").fill("Jordan");
  await page.getByLabel("Date of birth").fill("1988-06-14");
  await page.getByLabel("Current living situation").fill("Temporary shelter");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Client information saved.")).toBeVisible();

  await page.getByRole("link", { name: "Household", exact: true }).click();
  await page.waitForURL(/\/household$/);
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Riley Lee");
  await page.getByLabel("Relationship").fill("Child");
  await page.getByLabel("Date of birth").fill("2017-04-12");
  await page.getByRole("button", { name: "Add member" }).click();
  await expect(page.getByText("Riley Lee", { exact: true }).first()).toBeVisible();

  await page.getByRole("link", { name: "Program", exact: true }).click();
  await page.getByRole("radio", { name: /Harbor Bridge Transitional Housing/ }).check();
  await page.getByRole("button", { name: "Save program and continue" }).click();
  await page.getByRole("link", { name: "Requirements", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Program requirements" })).toBeVisible();
  await expect(page.getByText("No government-issued identification has been added.")).toBeVisible();

  await page.getByRole("link", { name: "Source documents", exact: true }).click();
  await page.locator("#file").setInputFiles({ name: "sample-id.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 synthetic identity fixture") });
  await page.getByRole("button", { name: "Upload and process" }).click();
  await expect(page.getByTestId("extraction-document_number")).toBeVisible();
  const legalName = page.getByTestId("extraction-legal_name");
  await legalName.getByRole("textbox").fill("Jordan Lee");
  await legalName.getByTitle("Save edit").click();
  await expect(legalName.getByText("Edited")).toBeVisible();
  await page.getByTestId("extraction-date_of_birth").getByTitle("Approve").click();
  await page.getByTestId("extraction-document_number").getByTitle("Reject").click();
  await expect(page.getByTestId("extraction-document_number").getByText("Rejected")).toBeVisible();

  await page.locator("#file").setInputFiles({ name: "sample-income.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 synthetic income fixture") });
  await page.getByLabel("Document category").selectOption("INCOME");
  await page.getByRole("button", { name: "Upload and process" }).click();
  await expect(page.getByTestId("extraction-gross_monthly_income")).toBeVisible();
  await page.getByRole("link", { name: "Requirements", exact: true }).click();
  await expect(page.getByText("Satisfied").first()).toBeVisible();
  await expect(page.getByText("Needs staff review").first()).toBeVisible();
  await expect(page.getByText("Missing").first()).toBeVisible();

  await page.getByRole("link", { name: "Review summary", exact: true }).click();
  await page.getByRole("button", { name: "Generate review summary" }).click();
  await expect(page.getByRole("heading", { name: "Review summary preview" })).toBeVisible();
  await expect(page.getByText(/Snapshot notice/)).toBeVisible();
  const packetReferenceV1 = await page.locator("article h2").innerText();
  const pdfDownload = page.waitForEvent("download"); await page.getByRole("link", { name: "PDF" }).click(); expect((await pdfDownload).suggestedFilename()).toBe(`${packetReferenceV1}.pdf`);
  const jsonDownload = page.waitForEvent("download"); await page.getByRole("link", { name: "JSON" }).click(); expect((await jsonDownload).suggestedFilename()).toBe(`${packetReferenceV1}.json`);
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByText(/was submitted for human review/)).toBeVisible();
  await page.getByRole("link", { name: "Back to case" }).click();
  await page.getByRole("link", { name: "History", exact: true }).click();
  await expect(page.getByText("Packet Submitted")).toBeVisible();

  await page.getByRole("button", { name: /Sign out/ }).click();
  await page.getByRole("button", { name: "Reviewer" }).click();
  await expect(page.getByText("Reviewer workspace")).toBeVisible();
  await page.getByRole("link", { name: /Open review queue/ }).click();
  await page.getByText(packetReferenceV1, { exact: true }).click();
  await page.getByRole("button", { name: "Approve packet" }).click();
  const approvalAlert = page.getByRole("alert").filter({ hasText: "Approval blocked" });
  await expect(approvalAlert).toContainText("Approval blocked");
  await expect(approvalAlert).toContainText("required packet fields");
  await page.getByLabel("Add reviewer note").fill("Income evidence still needs staff review before final approval.");
  await page.getByRole("button", { name: "Add note" }).click();
  await page.getByLabel("Return note").fill("Review the income fields and submit a new packet version.");
  await page.getByRole("button", { name: "Return" }).click();
  await expect(page.getByRole("heading", { name: "Review queue" })).toBeVisible();

  await page.getByRole("button", { name: /Sign out/ }).click();
  await page.getByRole("button", { name: "Caseworker" }).click();
  await expect(page.getByText("Caseworker workspace")).toBeVisible();
  await page.goto(`${caseUrl}/documents`);
  await page.getByTestId("extraction-legal_name").last().getByTitle("Approve").click();
  await page.getByTestId("extraction-gross_monthly_income").getByTitle("Approve").click();
  await page.goto(`${caseUrl}/client`);
  await page.getByLabel("Preferred name").fill("Jordan Updated");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Client information saved.")).toBeVisible();
  await page.goto(`${caseUrl}/packet`);
  await page.getByRole("button", { name: "Generate review summary" }).click();
  const packetReferenceV2 = await page.locator("article h2").innerText();
  expect(packetReferenceV2).not.toBe(packetReferenceV1);
  await expect(page.getByText("Jordan Updated").first()).toBeVisible();
  await page.getByRole("button", { name: "Submit for review" }).click();

  await page.getByRole("button", { name: /Sign out/ }).click();
  await page.getByRole("button", { name: "Reviewer" }).click();
  await expect(page.getByText("Reviewer workspace")).toBeVisible();
  await page.getByRole("link", { name: /Open review queue/ }).click();
  await page.getByText(packetReferenceV2, { exact: true }).click();
  await expect(page.getByRole("heading", { name: `Review ${packetReferenceV2}` })).toBeVisible();
  const fieldApprovals = page.getByRole("button", { name: "Approve", exact: true });
  const fieldCount = await fieldApprovals.count(); expect(fieldCount).toBe(6);
  for (let index = 0; index < fieldCount; index += 1) { await fieldApprovals.nth(index).click(); await expect(page.getByText("Approved", { exact: true })).toHaveCount(index + 1); }
  while (await page.getByRole("button", { name: "Record override" }).count()) {
    const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Record override" }) }).first();
    await form.getByRole("textbox").fill("Qualified reviewer accepted this missing item for the synthetic demonstration packet.");
    await form.getByRole("button", { name: "Record override" }).click();
  }
  await page.getByLabel("Add reviewer note").fill("All snapshot fields and written overrides were reviewed for this synthetic demonstration.");
  await page.getByRole("button", { name: "Add note" }).click();
  await expect(page.getByText("All approval rules are satisfied.")).toBeVisible();
  await page.getByRole("button", { name: "Approve packet" }).click();
  await expect(page.getByText("Approved", { exact: true }).first()).toBeVisible();
  await page.getByRole("link", { name: "View packet version history" }).click();
  await expect(page.getByText("V2", { exact: true })).toBeVisible();
  await expect(page.getByText("V1", { exact: true })).toBeVisible();
  await page.goto(`${caseUrl}/audit`);
  await expect(page.getByText("Packet Approved")).toBeVisible();
  await expect(page.getByText("Requirement Overridden").first()).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test("administrator creates, edits, and removes a requirement", async ({ page }) => {
  const browserErrors = monitor(page);
  await page.goto("/"); await page.getByRole("button", { name: "Administrator" }).click(); await expect(page.getByText("Administrator workspace")).toBeVisible();
  await page.getByRole("link", { name: "Programs" }).click();
  await page.getByRole("link", { name: "Create program" }).click();
  await page.getByLabel("Program name").fill("Lakeview Housing Demonstration");
  await page.getByLabel("Organization").fill("Lakeview Community Network");
  await page.getByLabel("Description").fill("A fictional housing program used only for portfolio demonstration workflows.");
  await page.getByRole("button", { name: "Create program" }).click();
  await expect(page.getByRole("heading", { name: "Lakeview Housing Demonstration" })).toBeVisible();
  await page.getByLabel("Program name").fill("Lakeview Housing Demonstration Revised");
  await page.getByRole("button", { name: "Save program details" }).click();
  await expect(page.getByRole("heading", { name: "Lakeview Housing Demonstration Revised" })).toBeVisible();
  await page.getByLabel("Requirement name").fill("Government identification review");
  await page.getByLabel("Category").selectOption("IDENTITY");
  await page.getByLabel("Description").last().fill("Review a current government identity document.");
  await page.getByLabel("Required extracted field").fill("legal_name");
  await page.getByRole("button", { name: "Add requirement" }).click();
  const requirement = page.locator("article").filter({ hasText: "Government identification review" });
  await expect(requirement).toBeVisible();
  await requirement.getByText("Edit requirement").click();
  await requirement.getByLabel("Description").fill("Review a current government identity document and confirm the legal name.");
  await requirement.getByRole("button", { name: "Save requirement" }).click();
  await expect(requirement.locator("div").filter({ hasText: /^Review a current government identity document and confirm the legal name\.$/ })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await requirement.getByRole("button", { name: "Remove requirement" }).click();
  await expect(requirement).toHaveCount(0);
  await page.getByRole("link", { name: "Staff access" }).click();
  await expect(page.getByText("caseworker@example.org")).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test("caseworker cannot access administrator pages", async ({ page }) => {
  await page.goto("/"); await page.getByRole("button", { name: "Caseworker" }).click(); await expect(page.getByText("Caseworker workspace")).toBeVisible(); await page.goto("/admin/programs"); await expect(page.getByRole("heading", { name: "This area is restricted" })).toBeVisible();
});
