import { describe, expect, it } from "vitest";

import {
  analyzePasswordSafety,
  createPwnedPasswordLookup,
  findPwnedPasswordCount,
} from "../../lib/security/password-safety";

describe("password safety analysis", () => {
  it("starts empty with an honest prompt", () => {
    expect(analyzePasswordSafety("")).toMatchObject({
      score: 0,
      level: "very-weak",
      length: 0,
      characterTypes: 0,
      suggestions: ["Enter a password to analyze it locally."],
    });
  });

  it("flags a common password and predictable sequence", () => {
    const result = analyzePasswordSafety("password");

    expect(result.level).toBe("very-weak");
    expect(result.score).toBeLessThanOrEqual(5);
    expect(result.warnings.join(" ")).toContain("common-password");
  });

  it("penalizes predictable sequences", () => {
    const result = analyzePasswordSafety("abcd1234");

    expect(result.warnings.join(" ")).toContain("predictable");
    expect(result.score).toBeLessThan(40);
  });

  it("rates a long varied value strongly without claiming certainty", () => {
    const result = analyzePasswordSafety("nR7!vQ2#zL9@pX4$gM8%");

    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.level).toBe("very-strong");
    expect(result.warnings).toEqual([]);
  });

  it("counts Unicode code points instead of UTF-16 units", () => {
    expect(analyzePasswordSafety("A9!🔐").length).toBe(4);
  });
});

describe("Pwned Passwords range lookup", () => {
  it("creates the documented SHA-1 prefix and suffix for a known vector", async () => {
    await expect(createPwnedPasswordLookup("password")).resolves.toEqual({
      prefix: "5BAA6",
      suffix: "1E4C9B93F3F0682250B6CF8331B7EE68FD8",
    });
  });

  it("rejects an empty value before hashing", async () => {
    await expect(createPwnedPasswordLookup("")).rejects.toThrow("Enter a password");
  });

  it("finds a matching suffix without counting padded rows", () => {
    const suffix = "1E4C9B93F3F0682250B6CF8331B7EE68FD8";
    const response = [
      "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:0",
      `${suffix.toLowerCase()}:3861493`,
      "malformed",
    ].join("\r\n");

    expect(findPwnedPasswordCount(response, suffix)).toBe(3_861_493);
    expect(findPwnedPasswordCount(response, "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")).toBe(0);
  });

  it("returns zero for an absent or invalid suffix", () => {
    const response = "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB:12";

    expect(findPwnedPasswordCount(response, "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC")).toBe(0);
    expect(findPwnedPasswordCount(response, "not-a-suffix")).toBe(0);
  });
});
