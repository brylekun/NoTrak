import type { Metadata } from "next";

import { siteName } from "@/lib/site";
import type { ToolDefinition } from "@/lib/tools/registry";

export function toolMetadata(tool: ToolDefinition): Metadata {
  const path = `/tools/${tool.slug}`;

  return {
    title: tool.name,
    description: tool.description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName,
      title: `${tool.name} | ${siteName}`,
      description: tool.description,
      url: path,
    },
    twitter: {
      card: "summary",
      title: `${tool.name} | ${siteName}`,
      description: tool.description,
    },
  };
}
