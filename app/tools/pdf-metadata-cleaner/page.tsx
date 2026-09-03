import type { Metadata } from "next";

import { PdfMetadataCleaner } from "@/components/tools/pdf-metadata-cleaner";
import { ToolShell } from "@/components/tool-shell";
import { getTool } from "@/lib/tools/registry";

const tool = getTool("pdf-metadata-cleaner")!;
export const metadata: Metadata = { title: tool.name, description: tool.description };

export default function PdfMetadataCleanerPage() {
  return <ToolShell tool={tool}><PdfMetadataCleaner /></ToolShell>;
}
