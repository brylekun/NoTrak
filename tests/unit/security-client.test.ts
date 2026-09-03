import { describe, expect, it } from "vitest";

import { SecurityApiError, readSecurityApiResponse } from "../../lib/security/client";

function jsonResponse(payload: unknown, status = 200) {
  return Response.json(payload, { status });
}

function brokenResponse(status = 200) {
  return new Response("<html>gateway error</html>", { status, headers: { "Content-Type": "text/html" } });
}

describe("readSecurityApiResponse", () => {
  it("returns the parsed payload on success", async () => {
    await expect(readSecurityApiResponse<{ ok: boolean }>(jsonResponse({ ok: true }))).resolves.toEqual({ ok: true });
  });

  it("maps a known error code to its own message", async () => {
    await expect(readSecurityApiResponse(jsonResponse({ code: "rate_limited" }, 429))).rejects.toThrow(/Wait a minute/i);
    await expect(readSecurityApiResponse(jsonResponse({ code: "body_too_large" }, 413))).rejects.toThrow(/too large/i);
    await expect(readSecurityApiResponse(jsonResponse({ code: "invalid_input" }, 400))).rejects.toThrow(/could not be checked/i);
    await expect(readSecurityApiResponse(jsonResponse({ code: "unsupported_media_type" }, 415))).rejects.toThrow(/Reload the page/i);
  });

  it("falls back to a generic message for an unrecognized code", async () => {
    await expect(readSecurityApiResponse(jsonResponse({ code: "something_new" }, 500))).rejects.toThrow(/could not be completed/i);
    await expect(readSecurityApiResponse(jsonResponse({}, 500))).rejects.toThrow(/could not be completed/i);
  });

  it("still reports a rate limit when the body is not JSON", async () => {
    await expect(readSecurityApiResponse(brokenResponse(429))).rejects.toThrow(/Wait a minute/i);
  });

  it("reports an unreadable success body rather than returning undefined", async () => {
    await expect(readSecurityApiResponse(brokenResponse(200))).rejects.toThrow(/unreadable/i);
  });

  it("throws a SecurityApiError so callers can separate it from a network failure", async () => {
    await expect(readSecurityApiResponse(jsonResponse({ code: "rate_limited" }, 429))).rejects.toBeInstanceOf(SecurityApiError);
    await expect(readSecurityApiResponse(jsonResponse({ code: "rate_limited" }, 429))).rejects.toMatchObject({ name: "SecurityApiError" });
  });

  it("does not surface a raw upstream error string to the visitor", async () => {
    const leaky = jsonResponse({ code: "request_failed", error: "ECONNREFUSED 10.0.0.5:443", upstream: "secret" }, 502);

    await expect(readSecurityApiResponse(leaky)).rejects.toThrow(/could not be completed/i);
    await expect(readSecurityApiResponse(jsonResponse({ code: "request_failed", error: "ECONNREFUSED" }, 502)))
      .rejects.not.toThrow(/ECONNREFUSED/);
  });
});
