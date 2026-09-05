import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

import { PWNED_PASSWORDS_RANGE_URL } from "../../lib/security/password-safety";
import { featuredTools, readyTools } from "../../lib/tools/registry";

test("the homepage features a curated set and links to the full index", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Useful tools");

  for (const tool of featuredTools) {
    await expect(page.getByRole("link", { name: new RegExp(tool.name, "i") }).first()).toBeVisible();
  }

  await page.getByRole("link", { name: /browse all tools/i }).first().click();
  await expect(page).toHaveURL(/\/tools$/);
});

test("the tools index exposes every released tool and filters them", async ({ page }) => {
  await page.goto("/tools", { waitUntil: "domcontentloaded" });

  for (const tool of readyTools) {
    await expect(page.getByRole("link", { name: new RegExp(tool.name, "i") }).first()).toBeVisible();
  }

  await page.getByRole("button", { name: /^Developer/ }).click();
  await expect(page.getByRole("status")).toContainText(`of ${readyTools.length} tools`);
  await expect(page.getByRole("link", { name: /JWT Decoder/i }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Speed Test/i })).toHaveCount(0);

  await page.getByRole("button", { name: /clear filters/i }).click();
  await expect(page.getByRole("status")).toContainText(`Showing all ${readyTools.length} tools`);

  await page.getByLabel(/search tools/i).fill("zzzzzz");
  await expect(page.getByText("No tools match that search.")).toBeVisible();
});

test("an unknown route renders the NoTrak 404 page", async ({ page }) => {
  const response = await page.goto("/tools/this-tool-does-not-exist", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("does not exist");
  await expect(page.getByRole("link", { name: /browse all tools/i })).toBeVisible();
});

test("the sitemap and robots files list the released tools", async ({ request }) => {
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  const xml = await sitemap.text();
  expect(xml).toContain("/tools");
  for (const tool of readyTools) {
    expect(xml, `sitemap is missing ${tool.slug}`).toContain(`/tools/${tool.slug}`);
  }

  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  const body = await robots.text();
  expect(body).toContain("Sitemap:");
  expect(body).toContain("Disallow: /api/");
});

test("the color theme initializes and persists an override", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("notrak-theme", "dark"));
  await page.reload({ waitUntil: "domcontentloaded" });

  await expect(page.locator("html")).toHaveClass(/dark/);
  const toggle = page.getByRole("button", { name: /color theme/i });
  await expect(toggle).toHaveAccessibleName("Color theme: dark. Switch to system.");

  await toggle.click();
  await expect(toggle).toHaveAccessibleName("Color theme: system. Switch to light.");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("notrak-theme"))).toBeNull();

  await toggle.click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await expect(toggle).toHaveAccessibleName("Color theme: light. Switch to dark.");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("notrak-theme"))).toBe("light");

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});

test("the theme toggle can return to following the system setting", async ({ page, browserName }) => {
  // Playwright's Firefox build does not apply colorScheme emulation to
  // matchMedia, so the "follows the OS" half of this cannot be set up there.
  // Verified by probe: matchMedia("(prefers-color-scheme: dark)").matches stays
  // false after emulateMedia({ colorScheme: "dark" }).
  test.skip(browserName === "firefox", "Firefox does not honour colorScheme emulation in matchMedia");

  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  // No stored preference means the OS setting wins.
  await expect(page.locator("html")).toHaveClass(/dark/);

  const toggle = page.getByRole("button", { name: /color theme/i });
  await toggle.click(); // system -> light, pinned against a dark OS
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("notrak-theme"))).toBe("light");

  await toggle.click(); // light -> dark
  await expect(page.locator("html")).toHaveClass(/dark/);

  await toggle.click(); // dark -> system, clearing the override entirely
  await expect.poll(() => page.evaluate(() => localStorage.getItem("notrak-theme"))).toBeNull();
  await expect(page.locator("html")).toHaveClass(/dark/);

  // Following the system again means a changed OS setting is picked up live.
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});

for (const tool of readyTools) {
  test(`${tool.name} has a usable release shell`, async ({ page }) => {
    const response = await page.goto(`/tools/${tool.slug}`, { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: tool.name })).toBeVisible();
    await expect(page.getByText(tool.mode === "local" ? "Processed locally" : "External lookup").first()).toBeVisible();
    await expect(page.getByText(tool.privacyNotice)).toBeVisible();
  });
}

test("the manifest and icons make NoTrak installable", async ({ page, request }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);

  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.status()).toBe(200);
  const parsed = await manifest.json();
  expect(parsed.name).toContain("NoTrak");
  expect(parsed.display).toBe("standalone");
  expect(parsed.start_url).toBe("/");
  expect(parsed.icons.length).toBeGreaterThanOrEqual(2);
  expect(parsed.icons.some((icon: { purpose?: string }) => icon.purpose === "maskable")).toBe(true);

  for (const icon of parsed.icons as Array<{ src: string }>) {
    const response = await request.get(icon.src);
    expect(response.status(), icon.src).toBe(200);
    expect(response.headers()["content-type"], icon.src).toContain("image/png");
  }
});

test("a cached local tool still works with the network cut off", async ({ page, context, browserName }) => {
  await page.goto("/tools/password-generator", { waitUntil: "load" });

  // Wait for the service worker to take control before removing the network.
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 15_000 });
  await page.goto("/tools/tracking-url-cleaner", { waitUntil: "load" });

  // The controlled navigation above must have populated the page cache. This
  // assertion runs in every engine, including WebKit, whose Playwright offline
  // emulation currently throws an internal error for top-level navigations.
  await expect
    .poll(() => page.evaluate(async () => Boolean(await caches.match(window.location.href))))
    .toBe(true);

  await context.setOffline(true);
  try {
    // Chromium and Firefox can reload a service-worker-controlled page while
    // Playwright emulates an offline connection. WebKit cannot represent that
    // navigation reliably, so it proves the cached response exists above and
    // still proves the already-loaded local workflow runs without a network.
    if (browserName !== "webkit") {
      await page.reload({ waitUntil: "domcontentloaded" });
    }
    await expect(page.getByRole("heading", { level: 1, name: "Tracking URL Cleaner" })).toBeVisible();

    // The tool must actually run, not merely render.
    await page.getByLabel("Link to clean").fill("https://example.com/a?utm_source=news&keep=1");
    await page.getByRole("button", { name: /remove trackers/i }).click();
    await expect(page.getByRole("textbox", { name: "Clean link" })).toHaveValue("https://example.com/a?keep=1");
  } finally {
    await context.setOffline(false);
  }
});

test("an uncached page falls back to the offline page rather than a browser error", async ({ page, context, browserName }) => {
  // Firefox lets the top-level navigation reach the server while offline, and
  // WebKit reports an internal automation error instead of exposing the service
  // worker response. Chromium is the only Playwright engine that can exercise
  // this exact offline-navigation path; all engines validate the cache and the
  // local workflow in the preceding test.
  test.skip(browserName !== "chromium", "This engine cannot emulate an offline top-level navigation reliably");

  await page.goto("/", { waitUntil: "load" });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 15_000 });

  await context.setOffline(true);
  try {
    await page.goto("/tools/jwt-decoder?cache-buster=offline-fallback", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 })).toContainText("No network");
  } finally {
    await context.setOffline(false);
  }
});

test("the service worker never caches a reputation or IP lookup", async ({ page }) => {
  await page.goto("/", { waitUntil: "load" });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 15_000 });

  await page.evaluate(async () => {
    await fetch("/api/ip", { cache: "no-store" });
    await fetch("/api/security/url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/" }),
    });
  });

  const cachedApiUrls = await page.evaluate(async () => {
    const names = await caches.keys();
    const found: string[] = [];
    for (const name of names) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        if (new URL(request.url).pathname.startsWith("/api/")) found.push(request.url);
      }
    }
    return found;
  });

  expect(cachedApiUrls).toEqual([]);
});

test("production security headers are present", async ({ page }) => {
  const response = await page.goto("/");
  const headers = response?.headers() ?? {};

  expect(headers["content-security-policy"]).toContain("default-src 'self'");
  expect(headers["content-security-policy"]).not.toContain("'unsafe-eval'");
  expect(headers["referrer-policy"]).toBe("no-referrer");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["permissions-policy"]).toContain("camera=(self)");
  expect(headers["permissions-policy"]).toContain("microphone=()");
  expect(headers["strict-transport-security"]).toContain("max-age=63072000");
});

test("reputation routes enforce their release boundaries", async ({ request }) => {
  const urlResponse = await request.post("/api/security/url", { data: { url: "https://example.com/" } });
  expect(urlResponse.status()).toBe(200);
  expect(urlResponse.headers()["cache-control"]).toContain("no-store");
  const urlPayload = await urlResponse.json();
  expect(urlPayload.warning).toContain("does not prove");

  const hashResponse = await request.post("/api/security/file-hash", { data: { sha256: "a".repeat(64) } });
  expect(hashResponse.status()).toBe(200);
  expect(hashResponse.headers()["cache-control"]).toContain("no-store");
  await expect(hashResponse.json()).resolves.toMatchObject({ fileUploaded: false, dataSent: "SHA-256 hash only" });

  const fileBody = await request.post("/api/security/file-hash", {
    data: "file=not-allowed",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  expect(fileBody.status()).toBe(415);

  const privateUrl = await request.post("/api/security/url", {
    data: { url: "http://[::ffff:127.0.0.1]/private" },
  });
  expect(privateUrl.status()).toBe(400);
  await expect(privateUrl.json()).resolves.toMatchObject({ code: "invalid_input" });
});

test("local phishing analysis does not call the reputation API", async ({ page }) => {
  let reputationRequests = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/security/url") reputationRequests += 1;
  });

  await page.goto("/tools/phishing-checker");
  await page.getByLabel("Suspicious URL").fill("http://192.0.2.4:8080/account/verify");
  await page.getByRole("button", { name: "Analyze locally" }).click();
  await expect(page.getByText("Local checks finished")).toBeVisible();
  expect(reputationRequests).toBe(0);
});

test("password safety analysis stays local until the visitor starts the breach check", async ({ page }) => {
  let rangeRequests = 0;
  page.on("request", (request) => {
    if (request.url().startsWith(PWNED_PASSWORDS_RANGE_URL)) rangeRequests += 1;
  });

  await page.goto("/tools/password-safety");
  await page.getByLabel("Password to check").fill("password");
  await expect(page.getByRole("heading", { name: /very weak/i })).toBeVisible();
  await expect(page.getByText(/common-password list/i)).toBeVisible();
  expect(rangeRequests).toBe(0);
});

test("the optional password breach check sends only a padded hash prefix", async ({ page }) => {
  const requests: Array<{ url: string; padding: string | undefined; body: string | null }> = [];
  await page.route(`${PWNED_PASSWORDS_RANGE_URL}/**`, async (route) => {
    const request = route.request();
    requests.push({
      url: request.url(),
      padding: request.headers()["add-padding"],
      body: request.postData(),
    });
    await route.fulfill({
      status: 200,
      contentType: "text/plain",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: [
        "1E4C9B93F3F0682250B6CF8331B7EE68FD8:3861493",
        "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:0",
      ].join("\r\n"),
    });
  });

  await page.goto("/tools/password-safety");
  await page.getByLabel("Password to check").fill("password");
  await page.getByRole("checkbox", { name: /five-character hash prefix/i }).check();
  await page.getByRole("button", { name: "Check breach corpus" }).click();

  await expect(page.getByRole("heading", { name: "Found in the breach corpus" })).toBeVisible();
  await expect(page.getByText(/3,861,493 times/)).toBeVisible();
  expect(requests).toEqual([
    {
      url: `${PWNED_PASSWORDS_RANGE_URL}/5BAA6`,
      padding: "true",
      body: null,
    },
  ]);
});

test("the image resizer exports exact dimensions without a processing request", async ({ page }) => {
  const processingRequests: string[] = [];
  await page.goto("/tools/image-resizer");
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/") || (url.protocol.startsWith("http") && url.origin !== "http://127.0.0.1:3100")) {
      processingRequests.push(request.url());
    }
  });

  await page.getByLabel("Image to resize").setInputFiles("public/icons/icon-192.png");
  await expect(page.getByText(/icon-192\.png · 192 × 192/)).toBeVisible();
  await page.getByLabel("Width").fill("96");
  await expect(page.getByLabel("Height")).toHaveValue("96");
  await page.getByRole("button", { name: "Resize image" }).click();

  await expect(page.getByRole("heading", { name: "Resized copy ready" })).toBeVisible();
  await expect(page.getByText(/96 × 96/).last()).toBeVisible();
  await expect
    .poll(() => page.getByAltText("Resized preview").evaluate((image: HTMLImageElement) => [image.naturalWidth, image.naturalHeight]))
    .toEqual([96, 96]);
  expect(processingRequests).toEqual([]);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download resized copy" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("icon-192-resized.png");
});

test("image-to-text recognizes and exports text locally, then works offline", async ({ page, context }) => {
  test.setTimeout(90_000);

  await page.setContent('<canvas id="source" width="1200" height="320"></canvas>');
  const image = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("#source")!;
    const drawing = canvas.getContext("2d")!;
    drawing.fillStyle = "white";
    drawing.fillRect(0, 0, canvas.width, canvas.height);
    drawing.fillStyle = "black";
    drawing.font = "700 76px Arial, sans-serif";
    drawing.fillText("NOTRAK OCR TEST 12345", 55, 190);
    return canvas.toDataURL("image/png").split(",")[1];
  });

  const processingRequests: string[] = [];
  await page.goto("/tools/image-to-text", { waitUntil: "load" });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 15_000 });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/") || (url.protocol.startsWith("http") && url.origin !== "http://127.0.0.1:3100")) {
      processingRequests.push(request.url());
    }
  });

  const input = page.getByLabel("Image containing printed text");
  await input.setInputFiles({ name: "notrak-ocr-test.png", mimeType: "image/png", buffer: Buffer.from(image, "base64") });
  await expect(page.getByText(/notrak-ocr-test\.png · 1200 × 320/i)).toBeVisible();
  await page.getByRole("button", { name: "Extract text" }).click();

  const output = page.getByLabel("Recognized text");
  await expect(output).toHaveValue(/NOTRAK OCR TEST 12345/i, { timeout: 45_000 });
  await expect(page.getByText(/Engine confidence: \d+%/)).toBeVisible();
  expect(processingRequests).toEqual([]);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download .txt" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("notrak-ocr-test-text.txt");
  const stream = await download.createReadStream();
  expect(stream).not.toBeNull();
  const chunks: Buffer[] = [];
  if (stream) for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks).toString("utf8")).toMatch(/NOTRAK OCR TEST 12345/i);

  await context.setOffline(true);
  try {
    await page.getByRole("button", { name: "Extract text" }).click();
    await expect(output).toHaveValue(/NOTRAK OCR TEST 12345/i, { timeout: 45_000 });
    await expect(page.getByText("Recognition complete")).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});

test("the PDF toolkit reorders, rotates, removes, and exports pages locally", async ({ page }) => {
  const first = await PDFDocument.create();
  first.addPage([100, 200]);
  first.addPage([210, 310]);
  const second = await PDFDocument.create();
  second.addPage([400, 500]);

  const processingRequests: string[] = [];
  await page.goto("/tools/pdf-toolkit");
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/") || (url.protocol.startsWith("http") && url.origin !== "http://127.0.0.1:3100")) {
      processingRequests.push(request.url());
    }
  });

  await page.getByLabel("PDF documents to merge or edit").setInputFiles([
    { name: "first.pdf", mimeType: "application/pdf", buffer: Buffer.from(await first.save()) },
    { name: "second.pdf", mimeType: "application/pdf", buffer: Buffer.from(await second.save()) },
  ]);
  await expect(page.getByText(/2 documents · 3 selected pages/)).toBeVisible();

  await page.getByRole("button", { name: "Rotate second.pdf, page 1 clockwise" }).click();
  await page.getByRole("button", { name: "Move second.pdf, page 1 up" }).click();
  await page.getByRole("button", { name: "Move second.pdf, page 1 up" }).click();
  await page.getByRole("button", { name: "Remove first.pdf, page 1" }).click();
  await expect(page.getByText(/2 documents · 2 selected pages/)).toBeVisible();

  await page.getByRole("button", { name: "Merge selected PDFs" }).click();
  await expect(page.getByRole("heading", { name: "Merged PDF ready" })).toBeVisible();
  expect(processingRequests).toEqual([]);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download merged PDF" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("notrak-combined.pdf");

  const stream = await download.createReadStream();
  expect(stream).not.toBeNull();
  const chunks: Buffer[] = [];
  if (stream) for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const output = await PDFDocument.load(Buffer.concat(chunks));
  expect(output.getPageCount()).toBe(2);
  expect(output.getPage(0).getSize()).toEqual({ width: 400, height: 500 });
  expect(output.getPage(0).getRotation().angle).toBe(90);
  expect(output.getPage(1).getSize()).toEqual({ width: 210, height: 310 });
});

test("the email header analyzer traces a spoofed message without any request", async ({ page }) => {
  const processingRequests: string[] = [];
  await page.goto("/tools/email-header-analyzer");
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/") || (url.protocol.startsWith("http") && url.origin !== "http://127.0.0.1:3100")) {
      processingRequests.push(request.url());
    }
  });

  await page.getByLabel("Raw email headers").fill([
    "Received: from mx.recipient.test ([10.0.0.8])",
    "\tby inbox.recipient.test with ESMTPS id zzz999;",
    "\tTue, 1 Sep 2026 09:20:00 +0000",
    "Received: from evil.test (evil.test [198.51.100.9])",
    "\tby mx.recipient.test with ESMTP id abc123;",
    "\tTue, 1 Sep 2026 09:14:02 +0000",
    "Authentication-Results: mx.recipient.test; spf=fail smtp.mailfrom=evil.test;",
    "\tdkim=fail header.d=evil.test; dmarc=fail header.from=bank.test",
    "From: billing@bank.test <invoices@evil.test>",
    "Reply-To: recovery@another-mailbox.test",
    "Subject: Urgent: verify your account to avoid suspension",
    "Message-ID: <spoof-1@evil.test>",
  ].join("\n"));
  await page.getByRole("button", { name: "Analyze locally" }).click();

  await expect(page.getByRole("heading", { name: "Strong warning signals" })).toBeVisible();
  await expect(page.getByText("DMARC failed")).toBeVisible();
  await expect(page.getByText("Display name contains a different address")).toBeVisible();
  await expect(page.getByText("Replies go to another domain")).toBeVisible();

  // The chain is ordered from the earliest visible hop toward the recipient, so
  // the public origin is hop 1 and the internal handoff is hop 2. Scoped to the
  // hop list because the pasted block itself also contains these addresses.
  const hops = page.getByRole("listitem").filter({ hasText: /^Hop \d/ });
  await expect(hops.nth(0)).toContainText("198.51.100.9");
  await expect(hops.nth(1)).toContainText("10.0.0.8 (private)");
  await expect(hops).toHaveCount(2);

  // Reported verdicts must never be presented as verification.
  await expect(page.getByText(/does not verify a signature or query DNS/i)).toBeVisible();
  await expect(page.getByText("A clean report is not a verdict.")).toBeVisible();

  await page.getByRole("button", { name: /^Show \d+$/ }).click();
  await expect(page.getByRole("term").filter({ hasText: /^Authentication-Results$/ })).toBeVisible();

  expect(processingRequests).toEqual([]);
});

test("the sensitive-data redactor reviews and sanitizes text without any request", async ({ page }) => {
  const processingRequests: string[] = [];
  await page.goto("/tools/sensitive-data-redactor");
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/") || (url.protocol.startsWith("http") && url.origin !== "http://127.0.0.1:3100")) {
      processingRequests.push(request.url());
    }
  });

  await page.getByLabel("Text to inspect").fill([
    "Email person@example.com and person@example.com.",
    "Server 203.0.113.10",
    "Card 4111 1111 1111 1111",
    "token=ghp_abcdefghijklmnopqrstuvwxyz123456",
    "Callback https://example.com/callback?access_token=abc123secret",
  ].join("\n"));
  await page.getByRole("button", { name: "Analyze locally" }).click();

  await expect(page.getByText("Review 5 unique findings")).toBeVisible();
  await expect(page.getByText(/6 occurrences found/)).toBeVisible();
  await expect(page.getByText("pe•••@example.com")).toBeVisible();
  await expect(page.getByText("•••• 1111")).toBeVisible();

  await page.getByRole("checkbox", { name: /Redact Payment-card number/ }).uncheck();
  const output = page.getByLabel("Sanitized result");
  await expect(output).toHaveValue([
    "Email [EMAIL_1] and [EMAIL_1].",
    "Server [IP_ADDRESS_1]",
    "Card 4111 1111 1111 1111",
    "token=[SECRET_1]",
    "Callback https://example.com/callback?access_token=[URL_SECRET_1]",
  ].join("\n"));
  expect(processingRequests).toEqual([]);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download sanitized copy" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("notrak-redacted.txt");
  const stream = await download.createReadStream();
  expect(stream).not.toBeNull();
  const chunks: Buffer[] = [];
  if (stream) for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks).toString("utf8")).toContain("Email [EMAIL_1]");
});

test("funding only loads the disclosed widget assets before interaction", async ({ page }) => {
  const thirdPartyRequests: string[] = [];
  const widgetAssets = new Set([
    "https://cdnjs.buymeacoffee.com/1.0.0/widget.prod.min.js",
    "https://cdn.buymeacoffee.com/widget/assets/coffee%20cup.svg",
    "https://cdn.buymeacoffee.com/assets/img/widget/loader.svg",
    "https://cdn.buymeacoffee.com/bmc_widget/font/710789a0-1557-48a1-8cec-03d52d663d74.eot",
  ]);
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol.startsWith("http") && url.origin !== "http://127.0.0.1:3100" && !widgetAssets.has(request.url())) thirdPartyRequests.push(request.url());
  });

  // The widget's donation page must remain unloaded until it is opened.
  await page.goto("/", { waitUntil: "load" });
  await expect(page.locator('script[data-name="BMC-Widget"]')).toHaveAttribute("data-id", "NoTrak");
  await expect(page.locator('script[data-name="BMC-Widget"]')).toHaveAttribute("data-color", "#40DCA5");
  const footer = page.locator("footer");
  await expect(footer.getByRole("link", { name: /GitHub Sponsors/ })).toHaveAttribute("href", "https://github.com/sponsors/brylekun");
  await expect(footer.getByRole("link", { name: /PayPal/ })).toHaveAttribute("href", "https://paypal.me/BryleMartin");

  await page.goto("/support", { waitUntil: "load" });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Keep NoTrak free");
  // Rendered through the Button primitive, which keeps button semantics on the
  // underlying anchor, matching the download links elsewhere in this suite.
  const outbound = page.getByRole("button", { name: /^Open / });
  await expect(outbound).toHaveCount(2);
  await expect(outbound.filter({ hasText: "GitHub Sponsors" })).toBeVisible();
  await expect(outbound.filter({ hasText: "PayPal" })).toBeVisible();

  // Outbound links must open in a new tab without handing over the referrer.
  for (const link of await outbound.all()) {
    await expect(link).toHaveAttribute("href", /^https:\/\//);
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noreferrer/);
  }

  expect(thirdPartyRequests).toEqual([]);
});

test("released pages do not overflow a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  for (const path of ["/", "/tools", "/privacy", "/methodology", "/support", "/offline", ...readyTools.map((tool) => `/tools/${tool.slug}`)]) {
    await page.goto(path);
    const dimensions = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    expect(dimensions.scroll, `${path} has horizontal overflow`).toBeLessThanOrEqual(dimensions.client);
  }
});
