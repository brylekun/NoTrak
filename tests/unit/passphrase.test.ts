import { describe, expect, it } from "vitest";

import { estimatePassphraseEntropy, generatePassphrase, PASSPHRASE_WORDS } from "../../lib/security/passphrase";

describe("passphrase generator", () => {
  it("uses the requested number of bundled words", () => {
    const value = generatePassphrase({ wordCount: 6, separator: "-", capitalize: false, includeNumber: false });
    const words = value.split("-");
    expect(words).toHaveLength(6);
    expect(words.every((word) => PASSPHRASE_WORDS.includes(word as (typeof PASSPHRASE_WORDS)[number]))).toBe(true);
  });

  it("can capitalize words and include a number", () => {
    const value = generatePassphrase({ wordCount: 5, separator: ".", capitalize: true, includeNumber: true });
    expect(value.split(".")).toHaveLength(5);
    expect(value).toMatch(/[0-9]{2}/u);
    expect(value.split(".").every((word) => /^[A-Z]/u.test(word))).toBe(true);
  });

  it("reports entropy from word choices and optional digits", () => {
    expect(estimatePassphraseEntropy(8, true)).toBeGreaterThan(60);
  });
});
