import { describe, expect, it } from "vitest";

import { assessExposure, privacyRecommendations, type BrowserPrivacySnapshot } from "../../lib/privacy/browser-privacy";

const snapshot: BrowserPrivacySnapshot = {
  doNotTrack: null,
  globalPrivacyControl: null,
  cookiesEnabled: true,
  language: "en-US",
  timezone: "Asia/Manila",
  screen: "1920 × 1080",
  colorDepth: 24,
  hardwareConcurrency: 8,
  deviceMemory: 8,
  touchPoints: 0,
  webRtcAvailable: true,
  canvasAvailable: true,
  userAgent: "Example Browser",
};

describe("browser privacy assessment", () => {
  it("describes observable surface without claiming anonymity", () => {
    expect(assessExposure(snapshot)).toEqual({ score: 10, level: "broad" });
    expect(privacyRecommendations(snapshot)).toContain("Block third-party cookies or use strict tracking protection.");
  });

  it("credits explicit privacy signals", () => {
    const base = assessExposure(snapshot).score;
    expect(assessExposure({ ...snapshot, doNotTrack: true, globalPrivacyControl: true }).score).toBe(base - 2);
  });
});
