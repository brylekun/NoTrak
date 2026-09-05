import { describe, expect, it } from "vitest";

import {
  MAX_REDACTOR_CHARACTERS,
  redactSensitiveData,
  redactedTextName,
  scanSensitiveData,
  validateSensitiveTextFile,
} from "../../lib/privacy/sensitive-data";

describe("sensitive-data scanning", () => {
  it("groups repeated email addresses under one consistent placeholder", () => {
    const text = "Contact person@example.com, then copy person@example.com.";
    const scan = scanSensitiveData(text);

    expect(scan.findings).toHaveLength(1);
    expect(scan.findings[0]).toMatchObject({
      kind: "email",
      preview: "pe•••@example.com",
      placeholder: "[EMAIL_1]",
    });
    expect(scan.findings[0].occurrences).toHaveLength(2);
    expect(redactSensitiveData(text, scan.findings, new Set([scan.findings[0].id])))
      .toBe("Contact [EMAIL_1], then copy [EMAIL_1].");
  });

  it("accepts a Luhn-valid payment card and rejects a similar invalid number", () => {
    const scan = scanSensitiveData("Valid 4111 1111 1111 1111; invalid 4111 1111 1111 1112.");

    expect(scan.findings.filter((item) => item.kind === "payment-card")).toEqual([
      expect.objectContaining({ preview: "•••• 1111", placeholder: "[PAYMENT_CARD_1]" }),
    ]);
  });

  it("detects known tokens, assigned secrets, JWTs, and private keys", () => {
    const text = [
      "token=ghp_abcdefghijklmnopqrstuvwxyz123456",
      'password="correct horse battery staple"',
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.c2lnbmF0dXJl",
      "-----BEGIN PRIVATE KEY-----\nabc123secret\n-----END PRIVATE KEY-----",
    ].join("\n");
    const kinds = scanSensitiveData(text).findings.map((item) => item.kind);

    expect(kinds).toEqual(expect.arrayContaining(["api-token", "jwt", "private-key"]));
    expect(kinds.filter((kind) => kind === "api-token")).toHaveLength(2);
  });

  it("finds URL credentials and sensitive query values without hiding the whole URL", () => {
    const text = "Open https://alice:s3cret@example.com/report?keep=1&access_token=abc%2F123.";
    const scan = scanSensitiveData(text);
    const urlSecrets = scan.findings.filter((item) => item.kind === "url-secret");

    expect(urlSecrets).toHaveLength(2);
    const output = redactSensitiveData(text, scan.findings, new Set(urlSecrets.map((item) => item.id)));
    expect(output).toBe("Open https://[URL_SECRET_1]@example.com/report?keep=1&access_token=[URL_SECRET_2].");
  });

  it("detects valid IPv4, IPv6, and formatted phone numbers", () => {
    const scan = scanSensitiveData("Hosts: 203.0.113.10 and 2001:db8::1. Call +63 917 123 4567.");

    expect(scan.findings.map((item) => item.kind)).toEqual(expect.arrayContaining(["ipv4", "ipv6", "phone"]));
    expect(scan.findings.find((item) => item.kind === "ipv4")?.preview).toBe("203.•••.•••.10");
    expect(scan.findings.find((item) => item.kind === "phone")?.preview).toBe("•••• 4567");
    expect(scan.findings.filter((item) => item.kind === "ipv4" || item.kind === "ipv6").map((item) => item.placeholder))
      .toEqual(["[IP_ADDRESS_1]", "[IP_ADDRESS_2]"]);
  });

  it("does not mistake a common log timestamp for a phone number", () => {
    const scan = scanSensitiveData("2026-09-04 10:20:30 request completed");

    expect(scan.findings.filter((item) => item.kind === "phone")).toEqual([]);
  });

  it("redacts only selected findings", () => {
    const text = "Email person@example.com from 203.0.113.10";
    const scan = scanSensitiveData(text);
    const email = scan.findings.find((item) => item.kind === "email")!;

    expect(redactSensitiveData(text, scan.findings, new Set([email.id])))
      .toBe("Email [EMAIL_1] from 203.0.113.10");
  });

  it("enforces the text limit and creates descriptive filenames", () => {
    expect(() => scanSensitiveData("x".repeat(MAX_REDACTOR_CHARACTERS + 1))).toThrow(/must not exceed/);
    expect(redactedTextName("server.log")).toBe("server-redacted.log");
    expect(redactedTextName()).toBe("notrak-redacted.txt");
  });

  it("accepts bounded text files and rejects empty, oversized, or binary selections", () => {
    expect(() => validateSensitiveTextFile({ name: "events.log", size: 100, type: "" })).not.toThrow();
    expect(() => validateSensitiveTextFile({ name: "data", size: 100, type: "text/plain" })).not.toThrow();
    expect(() => validateSensitiveTextFile({ name: "empty.txt", size: 0, type: "text/plain" })).toThrow(/empty/);
    expect(() => validateSensitiveTextFile({ name: "photo.png", size: 100, type: "image/png" })).toThrow(/plain-text/);
    expect(() => validateSensitiveTextFile({ name: "large.txt", size: 6 * 1024 * 1024, type: "text/plain" })).toThrow(/5 MB/);
  });
});
