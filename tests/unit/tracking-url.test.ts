import { describe, expect, it } from "vitest";

import { cleanTrackingUrl } from "../../lib/privacy/tracking-url";

describe("cleanTrackingUrl", () => {
  it("removes known tracking parameters and preserves useful query data", () => {
    const result = cleanTrackingUrl(
      "https://example.com/article?utm_source=newsletter&topic=privacy&fbclid=abc#details",
    );

    expect(result.cleanedUrl).toBe("https://example.com/article?topic=privacy#details");
    expect(result.removedParameters).toEqual(["utm_source", "fbclid"]);
  });

  it("recognizes common tracking parameter prefixes without matching their case", () => {
    const result = cleanTrackingUrl("https://example.com/?UTM_Campaign=launch&PK_SOURCE=site&id=42");

    expect(result.cleanedUrl).toBe("https://example.com/?id=42");
    expect(result.removedParameters).toEqual(["UTM_Campaign", "PK_SOURCE"]);
  });

  it("leaves an already clean link intact", () => {
    const result = cleanTrackingUrl("https://example.com/search?q=private+tools");

    expect(result.cleanedUrl).toBe("https://example.com/search?q=private+tools");
    expect(result.removedParameters).toEqual([]);
  });

  it("rejects unsupported schemes and embedded credentials", () => {
    expect(() => cleanTrackingUrl("javascript:alert(1)")).toThrow(/Only http/);
    expect(() => cleanTrackingUrl("https://user:secret@example.com/")).toThrow(/usernames or passwords/);
  });
});
