import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site";
import { readyTools } from "@/lib/tools/registry";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    { url: `${siteUrl}/`, lastModified, changeFrequency: "monthly", priority: 1 },
    { url: `${siteUrl}/tools`, lastModified, changeFrequency: "monthly", priority: 0.9 },
    { url: `${siteUrl}/privacy`, lastModified, changeFrequency: "yearly", priority: 0.5 },
    { url: `${siteUrl}/methodology`, lastModified, changeFrequency: "yearly", priority: 0.5 },
    ...readyTools.map((tool) => ({
      url: `${siteUrl}/tools/${tool.slug}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
