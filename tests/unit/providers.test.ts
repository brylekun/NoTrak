import { describe, expect, it, vi } from "vitest";
import { queryGoogleSafeBrowsing, queryMalwareBazaar, queryUrlhaus } from "../../lib/security/providers";

function fetcher(payload: unknown, status = 200) {
  return vi.fn(async () => Response.json(payload, { status })) as unknown as typeof fetch;
}

describe("reputation provider normalization", () => {
  it("does not contact unconfigured providers", async () => {
    const mock = fetcher({});
    await expect(queryGoogleSafeBrowsing("https://example.com", undefined, mock)).resolves.toMatchObject({ status: "not_configured" });
    await expect(queryUrlhaus("https://example.com", undefined, mock)).resolves.toMatchObject({ status: "not_configured" });
    await expect(queryMalwareBazaar("0".repeat(64), undefined, mock)).resolves.toMatchObject({ status: "not_configured" });
    expect(mock).not.toHaveBeenCalled();
  });

  it("authenticates Google requests without putting the API key in the URL", async () => {
    const request = vi.fn(async (...args: [RequestInfo | URL, RequestInit?]) => {
      void args;
      return Response.json({});
    });

    await expect(queryGoogleSafeBrowsing("https://example.com", "secret-key", request as unknown as typeof fetch)).resolves.toMatchObject({ status: "not_found" });

    const [input, options] = request.mock.calls[0]!;
    const endpoint = new URL(String(input));
    expect(endpoint.pathname).toBe("/v4/threatMatches:find");
    expect(endpoint.searchParams.has("key")).toBe(false);
    expect(options?.method).toBe("POST");
    expect(new Headers(options?.headers).get("x-goog-api-key")).toBe("secret-key");
    expect(JSON.parse(String(options?.body))).toMatchObject({
      threatInfo: {
        threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
        platformTypes: ["ANY_PLATFORM"],
        threatEntryTypes: ["URL"],
        threatEntries: [{ url: "https://example.com" }],
      },
    });
  });

  it("normalizes Google threat matches, misses, and provider failures", async () => {
    await expect(queryGoogleSafeBrowsing("https://example.com", "key", fetcher({ matches: [{ threatType: "SOCIAL_ENGINEERING" }] }))).resolves.toMatchObject({ status: "match", threatTypes: ["SOCIAL_ENGINEERING"] });
    await expect(queryGoogleSafeBrowsing("https://example.com", "key", fetcher({ matches: [] }))).resolves.toMatchObject({ status: "not_found" });
    await expect(queryGoogleSafeBrowsing("https://example.com", "key", fetcher({}))).resolves.toMatchObject({ status: "not_found" });
    await expect(queryGoogleSafeBrowsing("https://example.com", "key", fetcher({}, 503))).resolves.toMatchObject({ status: "unavailable" });
    await expect(queryGoogleSafeBrowsing("https://example.com", "key", fetcher({ matches: "malformed" }))).resolves.toMatchObject({ status: "invalid_response" });
    const timeout = vi.fn(async () => { throw new DOMException("Timed out", "AbortError"); }) as unknown as typeof fetch;
    await expect(queryGoogleSafeBrowsing("https://example.com", "key", timeout)).resolves.toMatchObject({ status: "timed_out" });
  });

  it("distinguishes Google failure causes instead of collapsing them", async () => {
    const cases: Array<[number, string]> = [
      [401, "authentication_failed"],
      [403, "authentication_failed"],
      [408, "timed_out"],
      // Google reports an exhausted daily allowance as 429.
      [429, "quota_exceeded"],
      [400, "invalid_response"],
      [500, "unavailable"],
      [503, "unavailable"],
    ];

    for (const [status, expected] of cases) {
      await expect(
        queryGoogleSafeBrowsing("https://example.com", "key", fetcher({}, status)),
        `HTTP ${status}`,
      ).resolves.toMatchObject({ status: expected });
    }
  });

  it("separates a Google timeout from a generic network failure", async () => {
    const aborted = vi.fn(async () => { throw new DOMException("Aborted", "AbortError"); }) as unknown as typeof fetch;
    const timedOut = vi.fn(async () => { throw new DOMException("Timed out", "TimeoutError"); }) as unknown as typeof fetch;
    const offline = vi.fn(async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch;

    await expect(queryGoogleSafeBrowsing("https://example.com", "key", aborted)).resolves.toMatchObject({ status: "timed_out" });
    await expect(queryGoogleSafeBrowsing("https://example.com", "key", timedOut)).resolves.toMatchObject({ status: "timed_out" });
    await expect(queryGoogleSafeBrowsing("https://example.com", "key", offline)).resolves.toMatchObject({ status: "unavailable" });
  });

  it("never turns a provider failure into a match or a miss", async () => {
    for (const status of [401, 403, 408, 429, 400, 500, 503]) {
      const result = await queryGoogleSafeBrowsing("https://example.com", "key", fetcher({}, status));
      expect(result.status).not.toBe("match");
      expect(result.status).not.toBe("not_found");
      expect(result.threatTypes).toEqual([]);
    }
  });

  it("normalizes URLhaus matches and misses", async () => {
    await expect(queryUrlhaus("https://example.com", "key", fetcher({ query_status: "ok", threat: "malware_download", tags: ["test"] }))).resolves.toMatchObject({ status: "match", threatTypes: ["malware_download", "test"] });
    await expect(queryUrlhaus("https://example.com", "key", fetcher({ query_status: "no_results" }))).resolves.toMatchObject({ status: "not_found" });
    await expect(queryUrlhaus("https://example.com", "bad-key", fetcher({}, 401))).resolves.toMatchObject({ status: "authentication_failed" });
  });

  it("distinguishes URLhaus failure causes", async () => {
    const cases: Array<[number, string]> = [
      [401, "authentication_failed"],
      [403, "authentication_failed"],
      // abuse.ch throttles rather than selling a quota.
      [429, "rate_limited"],
      [408, "timed_out"],
      [500, "unavailable"],
      [418, "invalid_response"],
    ];

    for (const [status, expected] of cases) {
      await expect(
        queryUrlhaus("https://example.com", "key", fetcher({}, status)),
        `HTTP ${status}`,
      ).resolves.toMatchObject({ status: expected });
    }

    await expect(queryUrlhaus("https://example.com", "key", fetcher({ query_status: "invalid_url" }))).resolves.toMatchObject({ status: "invalid_response" });
  });

  it("returns only minimal MalwareBazaar details", async () => {
    const request = vi.fn(async (...args: [RequestInfo | URL, RequestInit?]) => {
      void args;
      return Response.json({ query_status: "ok", data: [{ signature: "ExampleRAT", first_seen: "2026-01-01", file_type: "exe", tags: ["rat"], file_name: "secret.exe" }] });
    });
    const known = await queryMalwareBazaar("0".repeat(64), "key", request as unknown as typeof fetch);
    expect(known).toEqual({ provider: "MalwareBazaar", status: "known_malicious", signature: "ExampleRAT", firstSeen: "2026-01-01", fileType: "exe", tags: ["rat"] });
    const options = request.mock.calls[0]![1]!;
    expect(String(options.body)).toBe(`query=get_info&hash=${"0".repeat(64)}`);
    expect(String(options.body)).not.toContain("file=");
    await expect(queryMalwareBazaar("0".repeat(64), "key", fetcher({ query_status: "hash_not_found" }))).resolves.toMatchObject({ status: "not_found" });
    await expect(queryMalwareBazaar("0".repeat(64), "key", fetcher({}, 429))).resolves.toMatchObject({ status: "rate_limited" });
    await expect(queryMalwareBazaar("0".repeat(64), "key", fetcher({ query_status: "ok", data: "malformed" }))).resolves.toMatchObject({ status: "invalid_response" });
  });

  it("distinguishes MalwareBazaar failure causes without leaking upstream detail", async () => {
    const cases: Array<[number, string]> = [
      [401, "authentication_failed"],
      [429, "rate_limited"],
      [408, "timed_out"],
      [502, "unavailable"],
      [400, "invalid_response"],
    ];

    for (const [status, expected] of cases) {
      const result = await queryMalwareBazaar("0".repeat(64), "key", fetcher({ upstream: "internal detail" }, status));
      expect(result.status, `HTTP ${status}`).toBe(expected);
      expect(JSON.stringify(result)).not.toContain("internal detail");
    }
  });

  it("never turns a MalwareBazaar failure into a not_found", async () => {
    for (const status of [401, 429, 408, 502, 400]) {
      const result = await queryMalwareBazaar("0".repeat(64), "key", fetcher({}, status));
      expect(result.status).not.toBe("not_found");
      expect(result.status).not.toBe("known_malicious");
    }
  });
});
