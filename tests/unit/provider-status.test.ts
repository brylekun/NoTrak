import { describe, expect, it } from "vitest";

import {
  getProviderStatusPresentation,
  isProviderResultIncomplete,
  type MalwareProviderStatus,
  type UrlProviderStatus,
} from "../../lib/security/provider-status";

const urlStatuses: UrlProviderStatus[] = [
  "match",
  "not_found",
  "not_configured",
  "rate_limited",
  "quota_exceeded",
  "authentication_failed",
  "timed_out",
  "unavailable",
  "invalid_response",
];

const malwareStatuses: MalwareProviderStatus[] = [
  "known_malicious",
  "not_found",
  "not_configured",
  "rate_limited",
  "quota_exceeded",
  "authentication_failed",
  "timed_out",
  "unavailable",
  "invalid_response",
];

describe("provider status presentation", () => {
  it("describes every status a provider can return", () => {
    for (const status of [...urlStatuses, ...malwareStatuses]) {
      const presentation = getProviderStatusPresentation(status);
      expect(presentation, status).toBeDefined();
      expect(presentation.label.length, status).toBeGreaterThan(0);
      expect(presentation.detail.length, status).toBeGreaterThan(10);
    }
  });

  it("treats only a real answer as a complete check", () => {
    expect(isProviderResultIncomplete("match")).toBe(false);
    expect(isProviderResultIncomplete("known_malicious")).toBe(false);
    expect(isProviderResultIncomplete("not_found")).toBe(false);
  });

  it("treats every failure and an unconfigured provider as incomplete", () => {
    const failures: UrlProviderStatus[] = [
      "not_configured",
      "rate_limited",
      "quota_exceeded",
      "authentication_failed",
      "timed_out",
      "unavailable",
      "invalid_response",
    ];

    for (const status of failures) expect(isProviderResultIncomplete(status), status).toBe(true);
  });

  it("never describes a miss as safe", () => {
    const detail = getProviderStatusPresentation("not_found").detail;

    // Safety may only appear inside the negation, never as a standalone claim.
    expect(detail).toMatch(/does not prove/i);
    expect(detail.replace(/does not prove[^.]*/i, "")).not.toMatch(/safe/i);
  });

  it("does not expose upstream mechanics in an authentication failure", () => {
    const presentation = getProviderStatusPresentation("authentication_failed");

    // The visitor cannot act on a credential problem, so it reads as an
    // operator issue rather than an alarming security event.
    expect(presentation.label).not.toMatch(/key|credential|401|403/i);
    expect(presentation.detail).toMatch(/operator/i);
  });

  it("gives a distinct label to each failure cause", () => {
    const labels = [
      "rate_limited",
      "quota_exceeded",
      "authentication_failed",
      "timed_out",
      "unavailable",
      "invalid_response",
      "not_configured",
    ].map((status) => getProviderStatusPresentation(status as UrlProviderStatus).label);

    expect(new Set(labels).size).toBe(labels.length);
  });
});
