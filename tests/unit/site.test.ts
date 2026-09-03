import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

async function loadSiteUrl() {
  vi.resetModules();
  return (await import("../../lib/site")).siteUrl;
}

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  delete process.env.VERCEL_URL;
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.resetModules();
});

describe("siteUrl", () => {
  it("prefers an explicit site URL and drops trailing slashes", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://notrak.example/";

    await expect(loadSiteUrl()).resolves.toBe("https://notrak.example");
  });

  it("falls back to the Vercel production domain over the deployment domain", async () => {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "notrak.vercel.app";
    process.env.VERCEL_URL = "notrak-abc123.vercel.app";

    await expect(loadSiteUrl()).resolves.toBe("https://notrak.vercel.app");
  });

  it("uses the deployment domain when no production domain is set", async () => {
    process.env.VERCEL_URL = "notrak-abc123.vercel.app";

    await expect(loadSiteUrl()).resolves.toBe("https://notrak-abc123.vercel.app");
  });

  it("uses localhost for local development so canonical URLs stay valid", async () => {
    await expect(loadSiteUrl()).resolves.toBe("http://localhost:3000");
  });
});
