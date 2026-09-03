import { describe, expect, it } from "vitest";
import { decodeJwt } from "../../lib/developer/jwt";

function encode(value: unknown) { return Buffer.from(JSON.stringify(value)).toString("base64url"); }

describe("JWT decoder", () => {
  it("decodes Unicode JSON and reports NumericDate claims without verifying", () => {
    const token = `${encode({ alg: "none", typ: "JWT" })}.${encode({ sub: "José", exp: 900, nbf: 100 })}.signature`;
    const result = decodeJwt(token, 1000);
    expect(result.payload.sub).toBe("José");
    expect(result.expiration?.expired).toBe(true);
    expect(result.notBefore?.active).toBe(true);
    expect(result.signaturePresent).toBe(true);
  });

  it("allows an empty signature while making that state explicit", () => {
    const result = decodeJwt(`${encode({ alg: "none" })}.${encode({ ok: true })}.`);
    expect(result.signaturePresent).toBe(false);
  });

  it("rejects malformed, non-object, and oversized tokens", () => {
    expect(() => decodeJwt("abc.def")).toThrow("three dot-separated parts");
    expect(() => decodeJwt(`${encode([])}.${encode({})}.x`)).toThrow("header is not a JSON object");
    expect(() => decodeJwt(`${"a".repeat(33_000)}.e30.x`)).toThrow("too large");
  });
});
