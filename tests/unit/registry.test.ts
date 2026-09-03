import { describe, expect, it } from "vitest";

import { toolRegistry } from "../../lib/tools/registry";

describe("V1.1 tool registry", () => {
  it("publishes all 18 V1 and V1.1 tools", () => {
    expect(toolRegistry.filter((tool) => tool.status === "ready")).toHaveLength(18);
  });

  it("labels every ready tool with a processing mode and privacy disclosure", () => {
    for (const tool of toolRegistry.filter((entry) => entry.status === "ready")) {
      expect(["local", "external-lookup"]).toContain(tool.mode);
      expect(tool.privacyNotice.length).toBeGreaterThan(20);
    }
  });
});
