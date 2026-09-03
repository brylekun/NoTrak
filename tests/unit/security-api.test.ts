import { describe, expect, it } from "vitest";
import { POST as checkHash } from "../../app/api/security/file-hash/route";
import { POST as checkUrl } from "../../app/api/security/url/route";

function jsonRequest(path: string, body: unknown, headers: HeadersInit = {}) {
  return new Request(`http://localhost${path}`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
}

describe("security API boundaries", () => {
  it("returns local URL analysis while providers are unconfigured", async () => {
    const response = await checkUrl(jsonRequest("/api/security/url", { url: "https://example.com/" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    const payload = await response.json();
    expect(payload.providers).toEqual([
      { provider: "Google Safe Browsing", status: "not_configured", threatTypes: [] },
      { provider: "URLhaus", status: "not_configured", threatTypes: [] },
    ]);
  });

  it("rejects unsupported URL forms, extra fields, and oversized bodies", async () => {
    await expect(checkUrl(jsonRequest("/api/security/url", { url: "file:///etc/passwd" })).then((response) => response.status)).resolves.toBe(400);
    await expect(checkUrl(jsonRequest("/api/security/url", { url: "https://example.com", extra: true })).then((response) => response.status)).resolves.toBe(400);
    await expect(checkUrl(jsonRequest("/api/security/url", { url: "https://example.com" }, { "Content-Length": "5000" })).then((response) => response.status)).resolves.toBe(413);
  });

  it("accepts only an exact lowercase SHA-256 JSON contract", async () => {
    const valid = await checkHash(jsonRequest("/api/security/file-hash", { sha256: "a".repeat(64) }));
    expect(valid.status).toBe(200);
    expect(await valid.json()).toMatchObject({ status: "not_configured", fileUploaded: false, dataSent: "SHA-256 hash only" });
    await expect(checkHash(jsonRequest("/api/security/file-hash", { sha256: "A".repeat(64) })).then((response) => response.status)).resolves.toBe(400);
    await expect(checkHash(new Request("http://localhost/api/security/file-hash", { method: "POST", body: "hash=abc" })).then((response) => response.status)).resolves.toBe(415);
  });
});
