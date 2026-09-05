"use client";

import { useState } from "react";
import { Eye, RefreshCw, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { assessExposure, privacyRecommendations, type BrowserPrivacySnapshot, type SurfaceId } from "@/lib/privacy/browser-privacy";

type ExtendedNavigator = Navigator & { globalPrivacyControl?: boolean; deviceMemory?: number };

function preference(value: boolean | null) {
  if (value === true) return "Enabled";
  if (value === false) return "Disabled";
  return "Not reported";
}

export function BrowserPrivacyCheck() {
  const [snapshot, setSnapshot] = useState<BrowserPrivacySnapshot | null>(null);

  function inspect() {
    const browser = navigator as ExtendedNavigator;
    const dnt = navigator.doNotTrack;
    setSnapshot({
      doNotTrack: dnt === "1" ? true : dnt === "0" ? false : null,
      globalPrivacyControl: typeof browser.globalPrivacyControl === "boolean" ? browser.globalPrivacyControl : null,
      cookiesEnabled: navigator.cookieEnabled,
      language: navigator.language || "Not reported",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Not reported",
      screen: `${window.screen.width} × ${window.screen.height}`,
      colorDepth: window.screen.colorDepth,
      hardwareConcurrency: navigator.hardwareConcurrency || null,
      deviceMemory: browser.deviceMemory ?? null,
      touchPoints: navigator.maxTouchPoints,
      webRtcAvailable: "RTCPeerConnection" in window,
      canvasAvailable: Boolean(document.createElement("canvas").getContext("2d")),
      userAgent: navigator.userAgent,
    });
  }

  const assessment = snapshot ? assessExposure(snapshot) : null;
  const exposedById = new Map<SurfaceId, boolean>(
    assessment?.surfaces.map((surface) => [surface.id, surface.exposed]) ?? [],
  );

  type Row = { label: string; value: string; surface?: SurfaceId };
  const rows: Row[] = snapshot ? [
    { label: "Global Privacy Control", value: preference(snapshot.globalPrivacyControl) },
    { label: "Do Not Track", value: preference(snapshot.doNotTrack) },
    { label: "Cookies", value: snapshot.cookiesEnabled ? "Enabled" : "Disabled", surface: "cookies" },
    { label: "Language", value: snapshot.language, surface: "language" },
    { label: "Timezone", value: snapshot.timezone, surface: "timezone" },
    { label: "Screen", value: snapshot.screen, surface: "screen" },
    { label: "Color depth", value: snapshot.colorDepth > 0 ? `${snapshot.colorDepth}-bit` : "Not reported", surface: "colorDepth" },
    { label: "CPU hint", value: snapshot.hardwareConcurrency ? `${snapshot.hardwareConcurrency} logical cores` : "Not reported", surface: "hardwareConcurrency" },
    { label: "Memory hint", value: snapshot.deviceMemory ? `${snapshot.deviceMemory} GB` : "Not reported", surface: "deviceMemory" },
    { label: "Touch points", value: snapshot.touchPoints.toString(), surface: "touchPoints" },
    { label: "WebRTC", value: snapshot.webRtcAvailable ? "Available" : "Unavailable", surface: "webRtc" },
    { label: "Canvas", value: snapshot.canvasAvailable ? "Available" : "Unavailable", surface: "canvas" },
    { label: "Browser identifier", value: snapshot.userAgent, surface: "userAgent" },
  ] : [];

  return (
    <div>
      <div className="callout-neutral">
        This check shows information any ordinary webpage can read after you open it. It does not identify trackers, test third-party cookies, or prove that you are anonymous.
      </div>

      <Button className="mt-5 h-10 px-4" onClick={inspect}>
        {snapshot ? <RefreshCw aria-hidden="true" /> : <Eye aria-hidden="true" />}
        {snapshot ? "Run again" : "Inspect this browser"}
      </Button>

      {snapshot && assessment && (
        <div className="result-enter mt-7" aria-live="polite">
          <div className="rounded-2xl border border-primary/20 bg-primary/6 p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary"><ShieldAlert /></span>
              <div>
                <p className="font-semibold capitalize">{assessment.level} browser exposure</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {assessment.exposedCount} of {assessment.maxScore} common browser surfaces were exposed or enabled.
                  {assessment.protections > 0
                    ? ` Your browser sends ${assessment.protections === 2 ? "both tracking preferences" : "a tracking preference"}, which lowers the score to ${assessment.score}.`
                    : " No protective tracking preference was enabled, so nothing was deducted."}
                </p>
              </div>
            </div>
          </div>

          <dl className="mt-5 divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/70">
            {rows.map(({ label, value, surface }) => {
              const exposed = surface ? exposedById.get(surface) : undefined;
              return (
                <div key={label} className="grid gap-1 px-4 py-3 sm:grid-cols-[11rem_1fr_6.5rem] sm:items-baseline sm:gap-4">
                  <dt className="text-sm font-semibold">{label}</dt>
                  <dd className="break-words text-sm text-muted-foreground">{value}</dd>
                  {exposed === undefined ? (
                    <dd className="text-xs text-muted-foreground sm:text-right">—</dd>
                  ) : (
                    <dd className="sm:text-right">
                      <span className={exposed ? "surface-exposed" : "surface-withheld"}>
                        {exposed ? "Exposed" : "Reduced"}
                      </span>
                    </dd>
                  )}
                </div>
              );
            })}
          </dl>

          <div className="mt-5">
            <h2 className="text-base font-semibold">Practical improvements</h2>
            <ul className="mt-3 grid gap-2 text-sm leading-6 text-muted-foreground">
              {privacyRecommendations(snapshot).map((recommendation) => <li key={recommendation} className="rounded-xl bg-muted/60 px-4 py-3">{recommendation}</li>)}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
