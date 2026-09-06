import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("ZIP Toolkit creates and extracts files without a processing request", async ({ page }, testInfo) => {
  await page.goto("/tools/zip-toolkit");
  const processingRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (request.method() !== "GET" || url.pathname.startsWith("/api/")) processingRequests.push(request.url());
  });

  await page.getByLabel("Files to compress").setInputFiles([
    { name: "hello.txt", mimeType: "text/plain", buffer: Buffer.from("hello") },
    { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("private notes") },
  ]);
  await page.getByLabel("Archive name").fill("private bundle");
  await page.getByRole("button", { name: "Create ZIP", exact: true }).last().click();
  await expect(page.getByRole("heading", { name: "Archive ready" })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download ZIP" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("private bundle.zip");
  const archivePath = testInfo.outputPath("private-bundle.zip");
  await download.saveAs(archivePath);
  const archive = await readFile(archivePath);
  expect(archive.subarray(0, 2).toString()).toBe("PK");

  await page.getByRole("button", { name: "Extract ZIP" }).click();
  await page.getByLabel("ZIP archive").setInputFiles({ name: "private-bundle.zip", mimeType: "application/zip", buffer: archive });
  await expect(page.getByText("2 files · 18 B after extraction")).toBeVisible();
  await page.getByRole("button", { name: "Extract files" }).click();
  await expect(page.getByRole("heading", { name: "Extracted files ready" })).toBeVisible();
  await expect(page.getByRole("button", { name: "hello.txt" })).toBeVisible();
  expect(processingRequests).toEqual([]);
});

test("ZIP Toolkit rejects invalid archives and fits a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/tools/zip-toolkit");
  await page.getByRole("button", { name: "Extract ZIP" }).click();
  await page.getByLabel("ZIP archive").setInputFiles({ name: "broken.zip", mimeType: "application/zip", buffer: Buffer.from("not a zip") });
  await expect(page.getByText(/complete ZIP archive/i)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
