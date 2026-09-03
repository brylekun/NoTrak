import { expect, test } from "@playwright/test";

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

test("a local tool still works with the network cut off", async ({ page, context }) => {
  await page.goto("/tools/password-generator", { waitUntil: "load" });

  // Wait for the service worker to take control before removing the network.
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 15_000 });
  await page.goto("/tools/tracking-url-cleaner", { waitUntil: "load" });

  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: "domcontentloaded" });
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
  // Firefox's offline emulation blocks fetch() but not a top-level navigation,
  // so the navigation reaches the real server and the fallback never engages.
  // The service worker itself is exercised by the other offline tests.
  test.skip(browserName === "firefox", "Firefox offline emulation does not block top-level navigations");

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

test("released pages do not overflow a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  for (const path of ["/", "/tools", "/privacy", "/methodology", "/offline", ...readyTools.map((tool) => `/tools/${tool.slug}`)]) {
    await page.goto(path);
    const dimensions = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    expect(dimensions.scroll, `${path} has horizontal overflow`).toBeLessThanOrEqual(dimensions.client);
  }
});
