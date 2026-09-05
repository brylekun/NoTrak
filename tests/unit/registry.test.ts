import { describe, expect, it } from "vitest";

import { getToolGuide } from "../../lib/tools/guides";
import { featuredTools, readyTools, toolCategories, toolRegistry } from "../../lib/tools/registry";

describe("tool registry", () => {
  it("publishes every released tool", () => {
    // 18 V1/V1.1 tools plus the four V1.2 additions: EXIF Viewer, Base64
    // Converter, JSON Formatter, and Text Encryption, plus Password Safety,
    // Image Resizer, and PDF Toolkit, plus the Email Header Analyzer and
    // Sensitive Data Redactor, Image to Text, Private Resume Builder, and the
    // Private Video Toolkit.
    expect(readyTools).toHaveLength(30);
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

  it("gives every released tool a useful guide and valid related links", () => {
    const releasedSlugs = new Set(readyTools.map((tool) => tool.slug));

    for (const tool of readyTools) {
      const guide = getToolGuide(tool.slug);
      expect(guide.summary.length, tool.slug).toBeGreaterThan(40);
      expect(guide.useCases.length, tool.slug).toBeGreaterThanOrEqual(2);
      expect(guide.howItWorks.length, tool.slug).toBeGreaterThan(50);
      expect(guide.limitations.length, tool.slug).toBeGreaterThan(50);
      expect(guide.relatedSlugs.length, tool.slug).toBeGreaterThanOrEqual(3);
      expect(new Set(guide.relatedSlugs).size, tool.slug).toBe(guide.relatedSlugs.length);

      for (const relatedSlug of guide.relatedSlugs) {
        expect(releasedSlugs.has(relatedSlug), `${tool.slug} links to missing ${relatedSlug}`).toBe(true);
        expect(relatedSlug, tool.slug).not.toBe(tool.slug);
      }
    }
  });
});
