import { describe, expect, it } from "vitest";

import {
  CLOUDFLARE_DOH_URL,
  dnsLookupUrl,
  formatDnsTtl,
  inspectDomainInput,
  parseDnsResponse,
} from "../../lib/network/dns";

describe("DNS and domain inspection", () => {
  it("normalizes a plain public domain without treating it as a URL", () => {
    expect(inspectDomainInput("  Example.COM.  ")).toEqual({
      domain: "example.com",
      labels: ["example", "com"],
      sourceWasUrl: false,
      usesPunycode: false,
    });
  });

  it("removes every URL-specific component locally", () => {
    expect(inspectDomainInput("https://WWW.Example.com:8443/private?q=secret#part")).toEqual({
      domain: "www.example.com",
      labels: ["www", "example", "com"],
      sourceWasUrl: true,
      usesPunycode: false,
    });
  });

  it("normalizes internationalized hostnames to visible punycode", () => {
    expect(inspectDomainInput("https://bücher.example/path")).toMatchObject({
      domain: "xn--bcher-kva.example",
      usesPunycode: true,
    });
  });

  it.each([
    "",
    "localhost",
    "printer.local",
    "127.0.0.1",
    "https://user:password@example.com/",
    "ftp://example.com/file",
    "bad label.example",
  ])("rejects unsafe or non-public input %j", (input) => {
    expect(() => inspectDomainInput(input)).toThrow();
  });

  it("builds only the fixed Cloudflare lookup URL and expected query fields", () => {
    const url = new URL(dnsLookupUrl("example.com", "MX"));
    expect(url.origin + url.pathname).toBe(CLOUDFLARE_DOH_URL);
    expect(Object.fromEntries(url.searchParams)).toEqual({ name: "example.com", type: "MX", do: "true" });
  });

  it("validates and normalizes a successful resolver response", () => {
    expect(parseDnsResponse({
      Status: 0,
      TC: false,
      RD: true,
      RA: true,
      AD: true,
      CD: false,
      Answer: [{ name: "example.com.", type: 1, TTL: 3600, data: "93.184.216.34" }],
    })).toEqual({
      status: 0,
      statusLabel: "No error",
      authenticatedData: true,
      truncated: false,
      answers: [{ name: "example.com", type: "A", ttl: 3600, data: "93.184.216.34" }],
    });
  });

  it("handles known errors and a valid response without answers", () => {
    expect(parseDnsResponse({ Status: 3, TC: false, RD: true, RA: true, AD: false, CD: false })).toMatchObject({
      statusLabel: "Domain does not exist",
      answers: [],
    });
  });

  it("rejects malformed or excessive resolver output", () => {
    expect(() => parseDnsResponse({ Status: "0" })).toThrow("unreadable response");
    expect(() => parseDnsResponse({
      Status: 0,
      TC: false,
      RD: true,
      RA: true,
      AD: false,
      CD: false,
      Answer: Array.from({ length: 501 }, () => ({ name: "example.com.", type: 1, TTL: 1, data: "192.0.2.1" })),
    })).toThrow("unreadable response");
  });

  it("formats TTL values for people without losing the exact value", () => {
    expect(formatDnsTtl(45)).toBe("45s");
    expect(formatDnsTtl(125)).toBe("2m 5s");
    expect(formatDnsTtl(7260)).toBe("2h 1m");
    expect(formatDnsTtl(90_000)).toBe("1d 1h");
  });
});
