import { defineConfig, devices } from "@playwright/test";

const port = 3100;
const baseURL = `http://127.0.0.1:${port}`;

// Only this spec runs under the emulated phones; everything else assumes a
// desktop viewport and sets its own size where it needs one.
const MOBILE_SPEC = "**/mobile-layout.spec.ts";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // Firefox intermittently leaves one otherwise healthy navigation waiting
  // until the global timeout when contexts hit the shared production server in
  // parallel. The release suite is small, so serial execution is the reliable
  // tradeoff and still completes comfortably inside the CI job limit.
  workers: 1,
  timeout: 45_000,
  // Firefox can also take longer than Chromium to satisfy UI assertions. A
  // genuine failure still fails; it simply gets a less aggressive deadline.
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `pnpm start --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    // The desktop projects own the full suite. Several of its tests call
    // setViewportSize themselves, which would defeat a device descriptor, so
    // the mobile spec is kept out of them and run only under real devices.
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, testIgnore: MOBILE_SPEC },
    { name: "firefox", use: { ...devices["Desktop Firefox"] }, testIgnore: MOBILE_SPEC },
    { name: "webkit", use: { ...devices["Desktop Safari"] }, testIgnore: MOBILE_SPEC },
    // One device per engine. The landscape pass is intentionally scoped to the
    // safe-area test: its 852px CSS viewport activates the desktop navigation
    // and makes portrait-only scrolling/touch assertions inapplicable.
    { name: "mobile-safari", use: { ...devices["iPhone 15"] }, testMatch: MOBILE_SPEC },
    { name: "mobile-chrome", use: { ...devices["Pixel 8"] }, testMatch: MOBILE_SPEC },
    {
      name: "mobile-safari-landscape",
      use: { ...devices["iPhone 15 landscape"] },
      testMatch: MOBILE_SPEC,
      grep: /page gutter clears the safe-area inset/,
    },
  ],
});
