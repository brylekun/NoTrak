import { describe, expect, it } from "vitest";

import { MAX_ENCODE_CHARACTERS, decodeBase64, encodeBase64, encodeBase64Bytes } from "../../lib/developer/base64";

describe("encodeBase64", () => {
  it("encodes ASCII text", () => {
    expect(encodeBase64("Hello, NoTrak!")).toBe("SGVsbG8sIE5vVHJhayE=");
  });

  it("round-trips non-ASCII text through UTF-8", () => {
    for (const value of ["秘密のメッセージ", "café résumé", "emoji: 🔐🛡️", "Ω≈ç√∫"]) {
      expect(decodeBase64(encodeBase64(value))).toBe(value);
    }
  });

  it("encodes an empty string as an empty string", () => {
    expect(encodeBase64("")).toBe("");
  });

  it("uses the URL-safe alphabet when asked", () => {
    // This input produces both + and / in the standard alphabet.
    const standard = encodeBase64("ÿï¾", "standard");
    const urlsafe = encodeBase64("ÿï¾", "urlsafe");

    expect(standard).toMatch(/[+/]/);
    expect(urlsafe).not.toMatch(/[+/]/);
    expect(decodeBase64(urlsafe)).toBe("ÿï¾");
  });

  it("strips padding only when asked", () => {
    expect(encodeBase64("a", "urlsafe", false)).toMatch(/=$/);
    expect(encodeBase64("a", "urlsafe", true)).not.toMatch(/=/);
  });

  it("rejects an input beyond the size limit", () => {
    expect(() => encodeBase64("x".repeat(MAX_ENCODE_CHARACTERS + 1))).toThrow(/too large/i);
  });

  it("encodes raw bytes without going through text", () => {
    const bytes = new Uint8Array([0, 1, 2, 253, 254, 255]).buffer;

    expect(encodeBase64Bytes(bytes)).toBe("AAEC/f7/");
    expect(encodeBase64Bytes(bytes, "urlsafe")).toBe("AAEC_f7_");
  });
});

describe("decodeBase64", () => {
  it("decodes standard Base64", () => {
    expect(decodeBase64("SGVsbG8sIE5vVHJhayE=")).toBe("Hello, NoTrak!");
  });

  it("decodes URL-safe Base64 with missing padding", () => {
    expect(decodeBase64("SGVsbG8sIE5vVHJhayE")).toBe("Hello, NoTrak!");
  });

  it("ignores surrounding and internal whitespace", () => {
    expect(decodeBase64("  SGVsbG8s\n IE5vVHJh\tayE=  ")).toBe("Hello, NoTrak!");
  });

  it("rejects an empty value with a useful message", () => {
    expect(() => decodeBase64("   ")).toThrow(/Paste a Base64 value/i);
  });

  it("rejects characters that are not Base64", () => {
    expect(() => decodeBase64("not base64!!")).toThrow(/not valid in Base64/i);
    expect(() => decodeBase64("SGVsbG8$")).toThrow(/not valid in Base64/i);
  });

  it("rejects an impossible length", () => {
    expect(() => decodeBase64("SGVsbG8sIE5vVHJhayEA")).not.toThrow();
    expect(() => decodeBase64("A")).toThrow(/length is impossible/i);
  });

  it("reports binary content instead of returning replacement characters", () => {
    // 0xFF is not valid UTF-8 on its own.
    const binary = encodeBase64Bytes(new Uint8Array([0xff, 0xfe, 0xfd]).buffer, "standard");

    expect(() => decodeBase64(binary)).toThrow(/binary data/i);
  });

  it("rejects an oversized value", () => {
    expect(() => decodeBase64("A".repeat(MAX_ENCODE_CHARACTERS + 4))).toThrow(/too large/i);
  });

  it("round-trips a value containing a newline", () => {
    const value = "line one\nline two\n";

    expect(decodeBase64(encodeBase64(value))).toBe(value);
  });
});
