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

export function assessExposure(snapshot: BrowserPrivacySnapshot) {
  const surfaces = [
    snapshot.language,
    snapshot.timezone,
    snapshot.screen,
    snapshot.colorDepth,
    snapshot.hardwareConcurrency,
    snapshot.deviceMemory,
    snapshot.touchPoints,
    snapshot.webRtcAvailable,
    snapshot.canvasAvailable,
    snapshot.userAgent,
  ].filter((value) => value !== null && value !== "").length;

  const protections = Number(snapshot.doNotTrack === true) + Number(snapshot.globalPrivacyControl === true);
  const score = Math.max(0, Math.min(10, surfaces - protections));
  const level: ExposureLevel = score <= 4 ? "limited" : score <= 7 ? "moderate" : "broad";

  return { score, level };
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
