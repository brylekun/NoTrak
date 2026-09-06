import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

function makeWav(duration = 2, sampleRate = 44_100) {
  const samples = Math.round(duration * sampleRate);
  const buffer = Buffer.alloc(44 + samples * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(samples * 2, 40);
  for (let index = 0; index < samples; index += 1) {
    buffer.writeInt16LE(Math.round(Math.sin(index / sampleRate * Math.PI * 2 * 440) * 8_000), 44 + index * 2);
  }
  return buffer;
}

test("audio toolkit trims, filters, and exports MP3 without a processing request", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.goto("/tools/audio-toolkit");
  const processingRequests: string[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (request.method() !== "GET" || path.startsWith("/api/")) processingRequests.push(request.url());
  });

  await page.getByLabel("Audio file").setInputFiles({ name: "private-note.wav", mimeType: "audio/wav", buffer: makeWav() });
  await expect(page.getByRole("heading", { name: "Original preview" })).toBeVisible();
  await page.getByLabel("End (seconds)").fill("1.25");
  await page.getByLabel("Audio volume").fill("125");
  await page.getByRole("checkbox", { name: "Normalize loudness" }).check();
  await page.getByRole("checkbox", { name: "Convert to mono" }).check();
  await page.getByLabel("Fade in (seconds)").fill("0.1");
  await page.getByLabel("Fade out (seconds)").fill("0.1");

  await page.getByRole("button", { name: "Create MP3" }).click();
  await expect(page.getByRole("heading", { name: "Processed audio" })).toBeVisible({ timeout: 110_000 });
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download private-note-processed.mp3" }).click();
  const download = await downloadPromise;
  const outputPath = testInfo.outputPath("processed.mp3");
  await download.saveAs(outputPath);
  const output = await readFile(outputPath);
  expect(output.length).toBeGreaterThan(5_000);
  expect(output.toString("utf8")).not.toContain("private-note.wav");
  expect(processingRequests).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("audio-toolkit-result.png"), fullPage: true });
});

test("audio toolkit rejects invalid input and fits a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/tools/audio-toolkit");
  await page.getByLabel("Audio file").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("not audio") });
  await expect(page.getByText(/Choose a browser-readable MP3, M4A, AAC, WAV, OGG, or WebM/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
