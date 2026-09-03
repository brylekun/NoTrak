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
    await expect(queryGoogleSafeBrowsing("https://example.com", "key", fetcher({ matches: "malformed" }))).resolves.toMatchObject({ status: "unavailable" });
    const timeout = vi.fn(async () => { throw new DOMException("Timed out", "AbortError"); }) as unknown as typeof fetch;
    await expect(queryGoogleSafeBrowsing("https://example.com", "key", timeout)).resolves.toMatchObject({ status: "unavailable" });
  });

  it("normalizes URLhaus matches and misses", async () => {
    await expect(queryUrlhaus("https://example.com", "key", fetcher({ query_status: "ok", threat: "malware_download", tags: ["test"] }))).resolves.toMatchObject({ status: "match", threatTypes: ["malware_download", "test"] });
    await expect(queryUrlhaus("https://example.com", "key", fetcher({ query_status: "no_results" }))).resolves.toMatchObject({ status: "not_found" });
    await expect(queryUrlhaus("https://example.com", "bad-key", fetcher({}, 401))).resolves.toMatchObject({ status: "unavailable" });
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
    await expect(queryMalwareBazaar("0".repeat(64), "key", fetcher({}, 429))).resolves.toMatchObject({ status: "provider_unavailable" });
    await expect(queryMalwareBazaar("0".repeat(64), "key", fetcher({ query_status: "ok", data: "malformed" }))).resolves.toMatchObject({ status: "provider_unavailable" });
  });
});
