import { describe, expect, it } from "vitest";

import { toolBreadcrumbStructuredData, websiteStructuredData } from "../../lib/seo/structured-data";
import { getTool } from "../../lib/tools/registry";

describe("structured data", () => {
  it("describes NoTrak as the canonical website", () => {
    expect(websiteStructuredData("https://notrak.example")).toEqual({
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": "https://notrak.example/#website",
      url: "https://notrak.example/",
      name: "NoTrak",
      alternateName: "NoTrak Privacy Tools",
      description: "Private tools. Nothing stored.",
      inLanguage: "en",
    });
  });

  it("builds a complete absolute breadcrumb trail for a tool", () => {
    const tool = getTool("tracking-url-cleaner")!;
    const data = toolBreadcrumbStructuredData(tool, "https://notrak.example");

    expect(data["@type"]).toBe("BreadcrumbList");
    expect(data.itemListElement).toEqual([
      expect.objectContaining({ position: 1, name: "NoTrak", item: "https://notrak.example/" }),
      expect.objectContaining({ position: 2, name: "Tools", item: "https://notrak.example/tools" }),
      expect.objectContaining({
        position: 3,
        name: "Tracking URL Cleaner",
        item: "https://notrak.example/tools/tracking-url-cleaner",
      }),
    ]);
  });
});
