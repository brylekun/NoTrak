import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site";
import { readyTools } from "@/lib/tools/registry";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${siteUrl}/` },
    { url: `${siteUrl}/tools` },
    { url: `${siteUrl}/privacy` },
    { url: `${siteUrl}/methodology` },
    { url: `${siteUrl}/support` },
    ...readyTools.map((tool) => ({ url: `${siteUrl}/tools/${tool.slug}` })),
  ];
}
