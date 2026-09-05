import { describe, expect, it } from "vitest";

import { featuredTools, readyTools, toolCategories, toolRegistry } from "../../lib/tools/registry";

describe("tool registry", () => {
  it("publishes every released tool", () => {
    // 18 V1/V1.1 tools plus the four V1.2 additions: EXIF Viewer, Base64
    // Converter, JSON Formatter, and Text Encryption, plus Password Safety,
    // Image Resizer, and PDF Toolkit, plus the Email Header Analyzer and
    // Sensitive Data Redactor and Image to Text.
    expect(readyTools).toHaveLength(28);
    expect(readyTools).toHaveLength(toolRegistry.filter((tool) => tool.status === "ready").length);
  });

  it("labels every ready tool with a processing mode and privacy disclosure", () => {
    for (const tool of toolRegistry.filter((entry) => entry.status === "ready")) {
      expect(["local", "external-lookup"]).toContain(tool.mode);
      expect(tool.privacyNotice.length).toBeGreaterThan(20);
    }
  });

  it("features a small curated homepage subset drawn from released tools", () => {
    expect(featuredTools.length).toBeGreaterThan(2);
    expect(featuredTools.length).toBeLessThan(readyTools.length);
    for (const tool of featuredTools) expect(tool.status).toBe("ready");
  });

  it("uses only declared categories so the tools index can filter completely", () => {
    for (const tool of toolRegistry) expect(toolCategories).toContain(tool.category);
    for (const category of toolCategories) {
      expect(readyTools.some((tool) => tool.category === category), `no ready tool in ${category}`).toBe(true);
    }
  });

  it("keeps every slug unique", () => {
    expect(new Set(toolRegistry.map((tool) => tool.slug)).size).toBe(toolRegistry.length);
  });
});
