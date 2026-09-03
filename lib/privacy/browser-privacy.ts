export type ExposureLevel = "limited" | "moderate" | "broad";

export type BrowserPrivacySnapshot = {
  doNotTrack: boolean | null;
  globalPrivacyControl: boolean | null;
  cookiesEnabled: boolean;
  language: string;
  timezone: string;
  screen: string;
  colorDepth: number;
  hardwareConcurrency: number | null;
  deviceMemory: number | null;
  touchPoints: number;
  webRtcAvailable: boolean;
  canvasAvailable: boolean;
  userAgent: string;
};

export type SurfaceId =
  | "language"
  | "timezone"
  | "screen"
  | "colorDepth"
  | "hardwareConcurrency"
  | "deviceMemory"
  | "touchPoints"
  | "webRtc"
  | "canvas"
  | "userAgent"
  | "cookies";

export type SurfaceAssessment = {
  id: SurfaceId;
  label: string;
  exposed: boolean;
};

// A surface counts only when the browser actually reveals something. A withheld
// value, a disabled capability, and a zero reading are all non-exposure -- an
// earlier version tested only for `null` and `""`, so `false` and `0` counted as
// exposed and every browser scored the same regardless of how it was hardened.
function reportsText(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized !== "" && normalized !== "not reported" && normalized !== "unavailable";
}

export function evaluateSurfaces(snapshot: BrowserPrivacySnapshot): SurfaceAssessment[] {
  return [
    { id: "language", label: "Language", exposed: reportsText(snapshot.language) },
    { id: "timezone", label: "Timezone", exposed: reportsText(snapshot.timezone) },
    { id: "screen", label: "Screen size", exposed: reportsText(snapshot.screen) },
    { id: "colorDepth", label: "Color depth", exposed: snapshot.colorDepth > 0 },
    {
      id: "hardwareConcurrency",
      label: "CPU core hint",
      exposed: snapshot.hardwareConcurrency !== null && snapshot.hardwareConcurrency > 0,
    },
    {
      id: "deviceMemory",
      label: "Memory hint",
      exposed: snapshot.deviceMemory !== null && snapshot.deviceMemory > 0,
    },
    { id: "touchPoints", label: "Touch points", exposed: snapshot.touchPoints > 0 },
    { id: "webRtc", label: "WebRTC", exposed: snapshot.webRtcAvailable === true },
    { id: "canvas", label: "Canvas", exposed: snapshot.canvasAvailable === true },
    { id: "userAgent", label: "Browser identifier", exposed: reportsText(snapshot.userAgent) },
    { id: "cookies", label: "Cookies", exposed: snapshot.cookiesEnabled === true },
  ];
}

export function assessExposure(snapshot: BrowserPrivacySnapshot) {
  const surfaces = evaluateSurfaces(snapshot);
  const exposedCount = surfaces.filter((surface) => surface.exposed).length;
  const protections =
    Number(snapshot.doNotTrack === true) + Number(snapshot.globalPrivacyControl === true);

  const maxScore = surfaces.length;
  const score = Math.max(0, Math.min(maxScore, exposedCount - protections));

  // Proportional thresholds so the bands stay meaningful if a surface is added.
  const ratio = score / maxScore;
  const level: ExposureLevel = ratio < 0.45 ? "limited" : ratio < 0.75 ? "moderate" : "broad";

  return { score, maxScore, exposedCount, protections, level, surfaces };
}

export function privacyRecommendations(snapshot: BrowserPrivacySnapshot) {
  const recommendations: string[] = [];
  if (snapshot.globalPrivacyControl !== true) recommendations.push("Enable Global Privacy Control if your browser supports it.");
  if (snapshot.doNotTrack !== true) recommendations.push("Consider enabling your browser’s tracking-request preference.");
  if (snapshot.cookiesEnabled) recommendations.push("Block third-party cookies or use strict tracking protection.");
  if (snapshot.webRtcAvailable) recommendations.push("Review WebRTC permissions and use a trusted VPN if IP exposure is a concern.");
  recommendations.push("Use anti-fingerprinting protection for stronger resistance to cross-site identification.");
  return recommendations;
}
