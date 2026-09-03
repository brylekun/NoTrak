import type { MetadataRoute } from "next";

import { siteName, siteTagline } from "@/lib/site";
import { featuredTools } from "@/lib/tools/registry";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${siteName} — ${siteTagline}`,
    short_name: siteName,
    description:
      "Privacy-first browser tools with no accounts, file uploads, or saved history. Local tools keep working offline.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fbfdfc",
    theme_color: "#128571",
    categories: ["utilities", "productivity", "security"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: featuredTools.slice(0, 4).map((tool) => ({
      name: tool.name,
      url: `/tools/${tool.slug}`,
      description: tool.description,
    })),
  };
}
