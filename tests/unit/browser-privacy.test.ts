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
    const assessment = assessExposure(snapshot);

    // touchPoints is 0 on this desktop snapshot, so 10 of the 11 surfaces read.
    expect(assessment.exposedCount).toBe(10);
    expect(assessment.maxScore).toBe(11);
    expect(assessment.score).toBe(10);
    expect(assessment.level).toBe("broad");
    expect(privacyRecommendations(snapshot)).toContain("Block third-party cookies or use strict tracking protection.");
  });

  it("credits explicit privacy signals", () => {
    const base = assessExposure(snapshot).score;
    expect(assessExposure({ ...snapshot, doNotTrack: true, globalPrivacyControl: true }).score).toBe(base - 2);
  });

  it("does not count a disabled capability as an exposed surface", () => {
    const hardened = assessExposure({ ...snapshot, webRtcAvailable: false, canvasAvailable: false });

    expect(hardened.score).toBe(assessExposure(snapshot).score - 2);
    expect(hardened.surfaces.find((surface) => surface.id === "webRtc")?.exposed).toBe(false);
    expect(hardened.surfaces.find((surface) => surface.id === "canvas")?.exposed).toBe(false);
  });

  it("does not count a withheld numeric hint as an exposed surface", () => {
    const withheld = assessExposure({ ...snapshot, hardwareConcurrency: null, deviceMemory: null });

    expect(withheld.score).toBe(assessExposure(snapshot).score - 2);
  });

  it("does not count a zero reading as an exposed surface", () => {
    expect(assessExposure({ ...snapshot, colorDepth: 0 }).score).toBe(assessExposure(snapshot).score - 1);
    expect(assessExposure({ ...snapshot, touchPoints: 4 }).score).toBe(assessExposure(snapshot).score + 1);
  });

  it("treats a placeholder string as withheld rather than readable", () => {
    const withheld = assessExposure({ ...snapshot, language: "Not reported", timezone: "" });

    expect(withheld.score).toBe(assessExposure(snapshot).score - 2);
  });

  it("reaches a limited rating for a thoroughly hardened browser", () => {
    const hardened = assessExposure({
      ...snapshot,
      doNotTrack: true,
      globalPrivacyControl: true,
      cookiesEnabled: false,
      hardwareConcurrency: null,
      deviceMemory: null,
      touchPoints: 0,
      webRtcAvailable: false,
      canvasAvailable: false,
    });

    expect(hardened.level).toBe("limited");
    expect(hardened.score).toBeLessThan(assessExposure(snapshot).score);
  });

  it("separates every band across realistic browsers", () => {
    const levels = new Set([
      assessExposure(snapshot).level,
      assessExposure({ ...snapshot, doNotTrack: true, canvasAvailable: false, deviceMemory: null }).level,
      assessExposure({
        ...snapshot,
        doNotTrack: true,
        globalPrivacyControl: true,
        cookiesEnabled: false,
        hardwareConcurrency: null,
        deviceMemory: null,
        webRtcAvailable: false,
        canvasAvailable: false,
      }).level,
    ]);

    expect(levels).toEqual(new Set(["broad", "moderate", "limited"]));
  });
});
