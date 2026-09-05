import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { sampleResume } from "../../lib/resume/model";

test("resume editor exports a PDF and roundtrips a local draft without processing requests", async ({ page }) => {
  await page.goto("/tools/resume-builder");
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET" || new URL(request.url()).pathname.startsWith("/api/")) requests.push(request.url());
    expect(request.url()).not.toContain("Alex%20Rivera");
  });
  await page.getByRole("button", { name: "Load fictional example" }).click();
  await expect(page.getByRole("img", { name: "Resume preview page 1", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download PDF" })).toBeEnabled();
  await page.getByLabel("Template", { exact: true }).selectOption("compact");
  await page.getByLabel("Paper size", { exact: true }).selectOption("letter");
  await page.getByRole("checkbox", { name: "Summary", exact: true }).uncheck();
  await page.getByRole("button", { name: "Move Projects section up" }).click();
  await expect(page.locator("svg text").filter({ hasText: /^SUMMARY$/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Download PDF" })).toBeEnabled();

  const pdfDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  const pdfFile = await pdfDownload;
  const pdf = await PDFDocument.load(await readFile((await pdfFile.path())!));
  expect(pdf.getPages()[0].getSize()).toEqual({ width: 612, height: 792 });
  expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1);

  const draftDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  const draftPath = (await (await draftDownload).path())!;
  await page.getByRole("button", { name: "Clear all", exact: true }).click();
  await expect(page.getByLabel("Full name (required for PDF)")).toHaveValue("");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("Open resume draft file").setInputFiles(draftPath);
  await expect(page.getByLabel("Full name (required for PDF)")).toHaveValue("Alex Rivera");
  await expect(page.getByLabel("Template", { exact: true })).toHaveValue("compact");
  await expect(page.getByRole("checkbox", { name: "Summary", exact: true })).not.toBeChecked();
  expect(requests).toEqual([]);
  const storage = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
  expect(storage).not.toContain("Alex");
});

test("resume input handles invalid drafts and unsupported characters without losing edits", async ({ page }) => {
  await page.goto("/tools/resume-builder");
  await page.getByLabel("Full name (required for PDF)").fill("Example Person");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("Open resume draft file").setInputFiles({ name: "bad.json", mimeType: "application/json", buffer: Buffer.from('{"unexpected":true}') });
  await expect(page.getByText(/Could not open this draft/)).toBeVisible();
  await expect(page.getByLabel("Full name (required for PDF)")).toHaveValue("Example Person");
  await page.getByLabel("Full name (required for PDF)").fill("Example 😀");
  await expect(page.getByRole("alert").filter({ hasText: "Preview unavailable" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download PDF" })).toBeDisabled();
  await page.getByLabel("Full name (required for PDF)").fill("José Rivera");
  await expect(page.getByRole("button", { name: "Download PDF" })).toBeEnabled();
  await page.getByRole("button", { name: "Add experience", exact: true }).click();
  await page.getByLabel("Job title", { exact: true }).fill("Support specialist");
  await expect(page.locator("svg text").filter({ hasText: "Support specialist" })).toBeVisible();
});

test("resume builder fits a mobile screen", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/tools/resume-builder");
  await page.getByRole("button", { name: "Load fictional example" }).click();
  await expect(page.getByRole("button", { name: "Download PDF" })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("img", { name: "Resume preview page 1", exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole("img", { name: "Resume preview page 1", exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("mobile-preview.png") });
});

test("both resume templates export previewed pages and keep working offline", async ({ page, context }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/tools/resume-builder");
  await page.getByRole("button", { name: "Load fictional example" }).click();
  await expect(page.getByRole("button", { name: "Download PDF" })).toBeEnabled();
  await page.getByRole("heading", { name: "Contact details", exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("desktop-editor.png") });
  for (const template of ["classic", "compact"] as const) {
    await page.getByLabel("Template", { exact: true }).selectOption(template);
    await expect(page.getByRole("button", { name: "Download PDF" })).toBeEnabled();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download PDF" }).click();
    const file = await download;
    await file.saveAs(testInfo.outputPath(`${template}.pdf`));
    const pdf = await PDFDocument.load(await readFile((await file.path())!));
    await expect(page.locator('svg[aria-label^="Resume preview page"]')).toHaveCount(pdf.getPageCount());
  }
  // Fonts and the PDF library are already loaded; edits and exports need no provider.
  await context.setOffline(true);
  const draft = sampleResume();
  draft.summary = "Clear communication and reliable delivery. ".repeat(50);
  draft.experience[0].details = "A detailed achievement supported by evidence and good documentation. ".repeat(35);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("Open resume draft file").setInputFiles({ name: "long.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(draft)) });
  await expect(page.getByRole("button", { name: "Download PDF" })).toBeEnabled();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  const file = await download; await file.saveAs(testInfo.outputPath("multipage.pdf"));
  const pdf = await PDFDocument.load(await readFile((await file.path())!));
  expect(pdf.getPageCount()).toBeGreaterThan(1);
  await expect(page.locator('svg[aria-label^="Resume preview page"]')).toHaveCount(pdf.getPageCount());
});
