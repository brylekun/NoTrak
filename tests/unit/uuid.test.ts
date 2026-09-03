import { describe, expect, it } from "vitest";

import { generateUuids } from "../../lib/developer/uuid";

describe("UUID generator", () => {
  it("creates RFC 4122 version 4 UUIDs", () => {
    const values = generateUuids({ count: 8, uppercase: false, hyphens: true });
    expect(new Set(values).size).toBe(8);
    for (const value of values) {
      expect(value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
    }
  });

  it("supports uppercase UUIDs without hyphens", () => {
    expect(generateUuids({ count: 1, uppercase: true, hyphens: false })[0]).toMatch(/^[0-9A-F]{32}$/u);
  });
});
