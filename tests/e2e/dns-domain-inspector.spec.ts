import { expect, test } from "@playwright/test";

test("DNS inspector keeps URL details local and sends only a confirmed DNS query", async ({ page }) => {
  const lookups: Array<{ method: string; url: string; accept: string | undefined; body: string | null }> = [];
  // Context routing with an origin/path predicate is reliable across all three
  // Playwright engines. WebKit can bypass a page-level glob for a cross-origin
  // request, which would make this test depend on the resolver's live answer.
  await page.context().route((url) => url.origin === "https://cloudflare-dns.com" && url.pathname === "/dns-query", async (route) => {
    const request = route.request();
    lookups.push({
      method: request.method(),
      url: request.url(),
      accept: request.headers()["accept"],
      body: request.postData(),
    });
    await route.fulfill({
      status: 200,
      contentType: "application/dns-json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        Status: 0,
        TC: false,
        RD: true,
        RA: true,
        AD: true,
        CD: false,
        Answer: [{ name: "example.com.", type: 1, TTL: 300, data: "93.184.216.34" }],
      }),
    });
  });

  await page.goto("/tools/dns-domain-inspector");
  await page.getByLabel("Domain or website URL").fill("https://Example.COM/private?token=secret#fragment");
  await page.getByRole("button", { name: "Inspect locally" }).click();
  await expect(page.getByText("example.com", { exact: true })).toBeVisible();
  await expect(page.getByText("Website URL (path removed locally)")).toBeVisible();
  expect(lookups).toEqual([]);

  await page.getByLabel(/I understand that the domain/).check();
  await page.getByRole("button", { name: "Look up A records" }).click();
  await expect.poll(() => lookups.length).toBe(1);
  await expect(page.getByRole("heading", { name: "No error" })).toBeVisible();
  await expect(page.getByText("93.184.216.34")).toBeVisible();
  await expect(page.getByText("DNSSEC validated")).toBeVisible();

  expect(lookups).toHaveLength(1);
  const lookup = lookups[0]!;
  const lookupUrl = new URL(lookup.url);
  expect(lookup.method).toBe("GET");
  expect(lookup.accept).toContain("application/dns-json");
  expect(lookup.body).toBeNull();
  expect(Object.fromEntries(lookupUrl.searchParams)).toEqual({ name: "example.com", type: "A", do: "true" });
  expect(lookup.url).not.toContain("private");
  expect(lookup.url).not.toContain("secret");
  expect(lookup.url).not.toContain("fragment");
});

test("DNS inspector explains invalid input and fits a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/tools/dns-domain-inspector");
  await page.getByLabel("Domain or website URL").fill("localhost");
  await page.getByRole("button", { name: "Inspect locally" }).click();
  await expect(page.getByText("Enter a public domain name with at least two labels.")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
