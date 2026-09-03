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
    expect(result.removedFragmentParameters).toEqual([]);
    expect(result.removedPathSegments).toEqual([]);
  });

  it("rejects unsupported schemes and embedded credentials", () => {
    expect(() => cleanTrackingUrl("javascript:alert(1)")).toThrow(/Only http/);
    expect(() => cleanTrackingUrl("https://user:secret@example.com/")).toThrow(/usernames or passwords/);
  });

  it("removes the newer advertising click identifiers", () => {
    const result = cleanTrackingUrl(
      "https://shop.example/product?srsltid=abc&gad_source=1&ttclid=xyz&li_fat_id=1&epik=2&size=medium",
    );

    expect(result.cleanedUrl).toBe("https://shop.example/product?size=medium");
    expect(result.removedParameters).toEqual(["srsltid", "gad_source", "ttclid", "li_fat_id", "epik"]);
  });

  it("removes a YouTube share identifier but keeps the video id and timestamp", () => {
    const result = cleanTrackingUrl("https://www.youtube.com/watch?v=abc123&si=trackme&t=42");

    expect(result.cleanedUrl).toBe("https://www.youtube.com/watch?v=abc123&t=42");
    expect(result.removedParameters).toEqual(["si"]);
  });

  it("removes a Spotify share identifier", () => {
    const result = cleanTrackingUrl("https://open.spotify.com/track/xyz?si=abcdef");

    expect(result.cleanedUrl).toBe("https://open.spotify.com/track/xyz");
    expect(result.removedParameters).toEqual(["si"]);
  });

  it("removes Instagram sharing data without changing the selected carousel image", () => {
    const result = cleanTrackingUrl("https://www.instagram.com/p/example/?igsh=tracker&img_index=3");

    expect(result.cleanedUrl).toBe("https://www.instagram.com/p/example/?img_index=3");
    expect(result.removedParameters).toEqual(["igsh"]);
  });

  it("keeps a host-scoped parameter on an unrelated host", () => {
    // `si` is a share token on YouTube but an ordinary parameter elsewhere.
    const result = cleanTrackingUrl("https://maps.example/route?si=station-7");

    expect(result.cleanedUrl).toBe("https://maps.example/route?si=station-7");
    expect(result.removedParameters).toEqual([]);
  });

  it("applies host rules to subdomains and ignores a leading www", () => {
    expect(cleanTrackingUrl("https://music.youtube.com/watch?v=a&si=b").removedParameters).toEqual(["si"]);
    expect(cleanTrackingUrl("https://www.youtube.com/watch?v=a&si=b").removedParameters).toEqual(["si"]);
  });

  it("does not treat a lookalike host as a match", () => {
    // notyoutube.com must not inherit YouTube's rules.
    expect(cleanTrackingUrl("https://notyoutube.com/watch?v=a&si=b").removedParameters).toEqual([]);
  });

  it("strips an Amazon referral path segment and its tracking parameters", () => {
    const result = cleanTrackingUrl(
      "https://www.amazon.com/Some-Product/dp/B000000000/ref=sr_1_3?tag=aff-20&psc=1&keywords=usb",
    );

    expect(result.cleanedUrl).toBe("https://www.amazon.com/Some-Product/dp/B000000000?keywords=usb");
    expect(result.removedPathSegments).toEqual(["ref=sr_1_3"]);
    expect(result.removedParameters).toEqual(["tag", "psc"]);
  });

  it("does not strip a ref path segment on an unrelated host", () => {
    const result = cleanTrackingUrl("https://docs.example/ref=api/guide");

    expect(result.cleanedUrl).toBe("https://docs.example/ref=api/guide");
    expect(result.removedPathSegments).toEqual([]);
  });

  it("cleans tracking parameters hidden in a query-shaped fragment", () => {
    const result = cleanTrackingUrl("https://example.com/page#utm_source=email&section=intro");

    expect(result.cleanedUrl).toBe("https://example.com/page#section=intro");
    expect(result.removedFragmentParameters).toEqual(["utm_source"]);
  });

  it("drops the fragment entirely when it held nothing but trackers", () => {
    const result = cleanTrackingUrl("https://example.com/page#utm_source=email&utm_medium=cpc");

    expect(result.cleanedUrl).toBe("https://example.com/page");
    expect(result.removedFragmentParameters).toEqual(["utm_source", "utm_medium"]);
  });

  it("leaves an ordinary anchor fragment untouched", () => {
    expect(cleanTrackingUrl("https://example.com/doc#installation").cleanedUrl).toBe("https://example.com/doc#installation");
    expect(cleanTrackingUrl("https://example.com/doc#section-2").removedFragmentParameters).toEqual([]);
  });

  it("leaves a fragment that only looks partly like a parameter list", () => {
    // A single-page-app route must survive intact.
    const result = cleanTrackingUrl("https://example.com/app#/dashboard?utm_source=x");

    expect(result.cleanedUrl).toBe("https://example.com/app#/dashboard?utm_source=x");
    expect(result.removedFragmentParameters).toEqual([]);
  });

  it("removes every repetition of a duplicated tracking parameter", () => {
    const result = cleanTrackingUrl("https://example.com/?utm_source=a&utm_source=b&keep=1");

    expect(result.cleanedUrl).toBe("https://example.com/?keep=1");
    expect(result.removedParameters).toEqual(["utm_source"]);
  });

  it("keeps Matomo and Piwik campaign prefixes covered", () => {
    const result = cleanTrackingUrl("https://example.com/?mtm_campaign=a&matomo_campaign=b&piwik_kwd=c&id=1");

    expect(result.cleanedUrl).toBe("https://example.com/?id=1");
  });

  it("removes BBC and Yahoo referral parameters", () => {
    expect(cleanTrackingUrl("https://www.bbc.co.uk/news/article?at_medium=social&at_campaign=64").removedParameters)
      .toEqual(["at_medium", "at_campaign"]);
    expect(cleanTrackingUrl("https://finance.example/?guccounter=1&guce_referrer=abc").removedParameters)
      .toEqual(["guccounter", "guce_referrer"]);
  });

  it("keeps the path usable when a referral segment is the only segment", () => {
    const result = cleanTrackingUrl("https://www.amazon.com/ref=nav_logo");

    expect(result.cleanedUrl).toBe("https://www.amazon.com/");
    expect(result.removedPathSegments).toEqual(["ref=nav_logo"]);
  });
});
