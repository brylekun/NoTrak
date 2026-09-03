import { expect, test } from "@playwright/test";

import { toolRegistry } from "../../lib/tools/registry";

const readyTools = toolRegistry.filter((tool) => tool.status === "ready");

test("the homepage exposes every released tool", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Useful tools");

  for (const tool of readyTools) {
    await expect(page.getByRole("link", { name: new RegExp(tool.name, "i") }).first()).toBeVisible();
  }
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

  for (const path of ["/", ...readyTools.map((tool) => `/tools/${tool.slug}`)]) {
    await page.goto(path);
    const dimensions = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    expect(dimensions.scroll, `${path} has horizontal overflow`).toBeLessThanOrEqual(dimensions.client);
  }
});
