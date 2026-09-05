import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

const WEBM_FIXTURE = "GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJChYECGFOAZwEAAAAAAALfEU2bdLpNu4tTq4QVSalmU6yBoU27i1OrhBZUrmtTrIHkTbuMU6uEElTDZ1OsggFATbuMU6uEHFO7a1OsggLJ7AEAAAAAAABZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVSalmvirXsYMPQkB7qYtQcml2YXRlVGVzdE2AjExhdmY2My4xLjEwMVdBjExhdmY2My4xLjEwMUSJiECPQAAAAAAAFlSua9euAQAAAAAAAE7XgQFzxYiH3xcnFhYr4pyBACK1nIN1bmSIgQCGhVZfVlA5g4EBI+ODhAX14QDgkLCBoLqBWpqBAlWwhFW5gQFV7oEA7AEAAAAAAAACAAASVMNn/nNzn2PAgGfImUWjh0VOQ09ERVJEh4xMYXZmNjMuMS4xMDFzc9ljwItjxYiH3xcnFhYr4mfIpEWjh0VOQ09ERVJEh5dMYXZjNjMuMS4xMDEgbGlidnB4LXZwOWfIoUWjiERVUkFUSU9ORIeTMDA6MDA6MDEuMDAwMDAwMDAwAB9DtnVBAOeBAKOsgQAAgIJJg0IACfAFlgA4JBwYQgAAMGAAAGf7//+uQDR////saIdRUyilzwCjlYEAZACGAECSnABJQAADIAAAWfmG4KOVgQDIAIYAQJKcAErAAAMgAABZ+Ybgo5WBASwAhgBAkpwAScAAAyAAAFn5huCjlYEBkACGAECSnABIoAADIAAAWfmG4KOVgQH0AIYAQJKcAEeAAAMgAABZ+Ybgo5WBAlgAhgBAkpwARuAAAyAAAFn5huCjlYECvACGAECSnABGQAADIAAAWfmG4KOVgQMgAIYAQJKcAEXAAAMgAABZ+Ybgo5WBA4QAhgBAkpwARUAAAyAAAFn5huAcU7trkbuPs4EAt4r3gQHxggHD8IED";

test("video toolkit creates a thumbnail and local MP4 without a processing request", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.goto("/tools/video-toolkit");
  const processingRequests: string[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (request.method() !== "GET" || path.startsWith("/api/")) processingRequests.push(request.url());
  });

  await page.getByLabel("Video file").setInputFiles({
    name: "sample.webm",
    mimeType: "video/webm",
    buffer: Buffer.from(WEBM_FIXTURE, "base64"),
  });
  await expect(page.getByRole("heading", { name: "Original preview" })).toBeVisible();
  await page.getByLabel("Quality").selectOption("small");
  await page.getByRole("checkbox", { name: "Remove audio" }).check();

  const thumbnailDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Capture thumbnail" }).click();
  const thumbnail = await thumbnailDownload;
  const thumbnailBytes = await readFile((await thumbnail.path())!);
  expect([...thumbnailBytes.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);

  await page.getByRole("button", { name: "Create MP4" }).click();
  await expect(page.getByRole("heading", { name: "Processed video" })).toBeVisible({ timeout: 110_000 });
  const videoDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: /Download sample-processed\.mp4/ }).click();
  const output = await videoDownload;
  const outputPath = testInfo.outputPath("processed.mp4");
  await output.saveAs(outputPath);
  const outputBytes = await readFile(outputPath);
  expect(outputBytes.length).toBeGreaterThan(1_000);
  expect(outputBytes.subarray(4, 8).toString("ascii")).toBe("ftyp");
  expect(outputBytes.toString("utf8")).not.toContain("sample.webm");
  expect(outputBytes.toString("utf8")).not.toContain("PrivateTest");
  expect(processingRequests).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("video-toolkit-result.png"), fullPage: true });
});

test("video toolkit cancels local processing without a processing request", async ({ page }) => {
  await page.goto("/tools/video-toolkit");
  const processingRequests: string[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (request.method() !== "GET" || path.startsWith("/api/")) processingRequests.push(request.url());
  });
  await page.getByLabel("Video file").setInputFiles({
    name: "cancel.webm",
    mimeType: "video/webm",
    buffer: Buffer.from(WEBM_FIXTURE, "base64"),
  });
  await expect(page.getByRole("heading", { name: "Original preview" })).toBeVisible();
  await page.getByRole("button", { name: "Create MP4" }).click();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("status")).toContainText("Processing canceled");
  await expect(page.getByRole("heading", { name: "Processed video" })).toHaveCount(0);
  expect(processingRequests).toEqual([]);
});

test("video toolkit rejects invalid files and fits mobile", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/tools/video-toolkit");
  await page.getByLabel("Video file").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not a video"),
  });
  await expect(page.getByRole("status")).toContainText("MP4 or WebM");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
