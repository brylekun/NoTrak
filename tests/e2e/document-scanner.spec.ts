import { expect, test, type Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

async function documentImage(page: Page) {
  await page.setContent('<canvas id="source" width="600" height="900"></canvas>');
  const encoded = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("#source")!;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "black";
    context.font = "700 42px Arial, sans-serif";
    context.fillText("PRIVATE DOCUMENT", 65, 150);
    context.font = "28px Arial, sans-serif";
    context.fillText("NoTrak local scan", 65, 215);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  return Buffer.from(encoded, "base64");
}

test("the private document scanner arranges images and exports a local PDF", async ({ page }) => {
  const png = await documentImage(page);
  const processingRequests: string[] = [];
  await page.goto("/tools/document-scanner");
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/") || (url.protocol.startsWith("http") && url.origin !== "http://127.0.0.1:3100")) {
      processingRequests.push(request.url());
    }
  });

  await page.getByLabel("Document photos").setInputFiles([
    { name: "front.png", mimeType: "image/png", buffer: png },
    { name: "back.png", mimeType: "image/png", buffer: png },
  ]);
  await expect(page.getByText("2 of 12 pages")).toBeVisible();
  await page.getByRole("button", { name: "Rotate front.png, page 1 clockwise" }).click();
  await page.getByRole("button", { name: "Move front.png, page 1 down" }).click();
  await expect(page.getByText("1. back.png")).toBeVisible();

  await page.getByRole("button", { name: "Create private PDF" }).click();
  await expect(page.getByRole("heading", { name: "Private PDF ready" })).toBeVisible();
  expect(processingRequests).toEqual([]);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download scanned PDF" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("notrak-scanned-document.pdf");
  if (process.env.SCANNER_QA_PDF) await download.saveAs(process.env.SCANNER_QA_PDF);
  const stream = await download.createReadStream();
  expect(stream).not.toBeNull();
  const chunks: Buffer[] = [];
  if (stream) for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const pdf = await PDFDocument.load(Buffer.concat(chunks));
  expect(pdf.getPageCount()).toBe(2);
  expect(pdf.getPage(0).getSize().width).toBeCloseTo(595.28, 1);
});

test("the private document scanner fits on a phone", async ({ page }) => {
  const png = await documentImage(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tools/document-scanner");
  await page.getByLabel("Document photos").setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: png });
  await expect(page.getByRole("button", { name: "Create private PDF" })).toBeEnabled();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("the private document scanner can add a local searchable text layer", async ({ page }) => {
  test.setTimeout(90_000);
  const png = await documentImage(page);
  await page.goto("/tools/document-scanner", { waitUntil: "load" });
  const externalRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/") || (url.protocol.startsWith("http") && url.origin !== "http://127.0.0.1:3100")) {
      externalRequests.push(request.url());
    }
  });
  await page.getByLabel("Document photos").setInputFiles({ name: "searchable.png", mimeType: "image/png", buffer: png });
  await page.getByLabel("Add searchable English text").check();
  await page.getByRole("button", { name: "Create private PDF" }).click();
  await expect(page.getByText(/searchable English text added/)).toBeVisible({ timeout: 60_000 });
  expect(externalRequests).toEqual([]);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download scanned PDF" }).click();
  const download = await downloadPromise;
  if (process.env.SCANNER_QA_SEARCHABLE_PDF) await download.saveAs(process.env.SCANNER_QA_SEARCHABLE_PDF);
});
