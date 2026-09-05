import { siteName, siteTagline, siteUrl } from "../site";
import type { ToolDefinition } from "../tools/registry";

export function websiteStructuredData(origin = siteUrl) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${origin}/#website`,
    url: `${origin}/`,
    name: siteName,
    alternateName: `${siteName} Privacy Tools`,
    description: siteTagline,
    inLanguage: "en",
  };
}

export function toolBreadcrumbStructuredData(tool: ToolDefinition, origin = siteUrl) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: siteName,
        item: `${origin}/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Tools",
        item: `${origin}/tools`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: tool.name,
        item: `${origin}/tools/${tool.slug}`,
      },
    ],
  };
}
