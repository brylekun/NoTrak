import { describe, expect, it } from "vitest";

import { generatePassword, type PasswordOptions } from "../../lib/security/password";

const options: PasswordOptions = {
  length: 32,
  lowercase: true,
  uppercase: true,
  numbers: true,
  symbols: true,
  avoidAmbiguous: true,
};

describe("generatePassword", () => {
  it("returns the requested length and includes every selected character group", () => {
    const password = generatePassword(options);

    expect(password).toHaveLength(32);
    expect(password).toMatch(/[a-z]/);
    expect(password).toMatch(/[A-Z]/);
    expect(password).toMatch(/[0-9]/);
    expect(password).toMatch(/[!@#$%^&*()\-_=+\[\]{};:,.?]/);
  });

  it("removes ambiguous characters when requested", () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      expect(generatePassword(options)).not.toMatch(/[Il1O0o|`'"]/);
    }
  });

  it("rejects an empty character selection", () => {
    expect(() =>
      generatePassword({
        ...options,
        lowercase: false,
        uppercase: false,
        numbers: false,
        symbols: false,
      }),
    ).toThrow(/at least one character type/);
  });
});
