import { describe, expect, it } from "vitest";

import { hasMoneroAddress, isLikelyMoneroAddress, moneroAddress, moneroUri, supportLinks } from "../../lib/support";

// A mainnet-shaped address used only to exercise the shape check. Built from
// Base58 characters so it never contains the ambiguous 0, O, I, or l.
const SAMPLE_ADDRESS = `4${"A1b2C3d4E5f6G7h8J9kLmNpQrStUvWxYz".repeat(3).slice(0, 94)}`;

describe("support links", () => {
  it("keeps every funding target an absolute HTTPS URL", () => {
    expect(supportLinks.length).toBeGreaterThan(0);
    for (const link of supportLinks) {
      const url = new URL(link.href);
      expect(url.protocol, link.id).toBe("https:");
      expect(link.label.length, link.id).toBeGreaterThan(0);
      expect(link.detail.length, link.id).toBeGreaterThan(0);
    }
  });

  it("keeps ids unique so the footer can key on them", () => {
    expect(new Set(supportLinks.map((link) => link.id)).size).toBe(supportLinks.length);
  });

  /*
   * Outbound support destinations remain plain links. The separately embedded
   * Buy Me a Coffee widget has its own disclosed asset requests.
   */
  it("points at no third-party image or script asset", () => {
    for (const link of supportLinks) {
      expect(link.href, link.id).not.toMatch(/\.(?:png|jpe?g|svg|gif|webp|js|css)(?:$|\?)/iu);
      expect(link.href, link.id).not.toContain("shields.io");
    }
  });
});

describe("Monero address handling", () => {
  it("accepts a standard 95-character address", () => {
    expect(SAMPLE_ADDRESS).toHaveLength(95);
    expect(isLikelyMoneroAddress(SAMPLE_ADDRESS)).toBe(true);
  });

  it("rejects a truncated, over-long, or wrongly prefixed address", () => {
    expect(isLikelyMoneroAddress(SAMPLE_ADDRESS.slice(0, 94))).toBe(false);
    expect(isLikelyMoneroAddress(`${SAMPLE_ADDRESS}A`)).toBe(false);
    expect(isLikelyMoneroAddress(`5${SAMPLE_ADDRESS.slice(1)}`)).toBe(false);
    expect(isLikelyMoneroAddress("")).toBe(false);
  });

  it("rejects Base58-ambiguous characters that a mistyped address would contain", () => {
    for (const character of ["0", "O", "I", "l"]) {
      expect(isLikelyMoneroAddress(`4${character}${SAMPLE_ADDRESS.slice(2)}`), character).toBe(false);
    }
  });

  /*
   * Guards the deliberate empty default. If an address is pasted in, this test
   * fails unless it also passes the shape check, which catches a truncated or
   * mistyped paste before it ever reaches the page.
   */
  it("either has no address configured or one that passes the shape check", () => {
    expect(hasMoneroAddress).toBe(isLikelyMoneroAddress(moneroAddress));
    if (moneroAddress) expect(hasMoneroAddress, "the configured Monero address is malformed").toBe(true);
  });

  it("builds a wallet URI a Monero client can open", () => {
    expect(moneroUri(SAMPLE_ADDRESS)).toBe(`monero:${SAMPLE_ADDRESS}`);
  });
});
