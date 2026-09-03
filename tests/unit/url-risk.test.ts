import { describe, expect, it } from "vitest";
import { analyzeUrlLocally, mergeProviderRisk, parsePublicHttpUrl } from "../../lib/security/url-risk";

describe("URL risk analysis", () => {
  it("accepts a conventional HTTPS URL without inventing warnings", () => {
    const result = analyzeUrlLocally("https://example.com/docs?q=privacy");
    expect(result.level).toBe("low");
    expect(result.signals).toEqual([]);
    expect(result.normalizedUrl).toBe("https://example.com/docs?q=privacy");
  });

  it("explains multiple suspicious structural signals", () => {
    const result = analyzeUrlLocally("http://192.0.2.4:8080/account/verify");
    expect(result.level).toBe("high");
    expect(result.signals.map((item) => item.id)).toEqual(expect.arrayContaining(["http", "ip-host", "port", "keywords"]));
  });

  it("detects mixed-script and Punycode hostnames", () => {
    const result = analyzeUrlLocally("https://раypal.example/login");
    expect(result.signals.map((item) => item.id)).toEqual(expect.arrayContaining(["mixed-script", "punycode", "keywords"]));
  });

  it("rejects active or credential-bearing URL forms", () => {
    expect(() => parsePublicHttpUrl("javascript:alert(1)")).toThrow("Only HTTP and HTTPS");
    expect(() => parsePublicHttpUrl("https://user:secret@example.com/")).toThrow("usernames or passwords");
    expect(() => parsePublicHttpUrl("http://127.0.0.1/admin")).toThrow("Private, local, and loopback");
    expect(() => parsePublicHttpUrl("https://router.local/")).toThrow("Private, local, and loopback");
    expect(() => parsePublicHttpUrl(`https://example.com/${"a".repeat(2050)}`)).toThrow("too long");
  });

  it("lets a provider match dominate a quiet local score", () => {
    const local = analyzeUrlLocally("https://example.com/");
    expect(mergeProviderRisk(local, true)).toEqual({ score: 85, level: "high" });
  });
});
