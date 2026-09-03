import { PdfMetadataCleaner } from "@/components/tools/pdf-metadata-cleaner";
import { ToolShell } from "@/components/tool-shell";
import { toolMetadata } from "@/lib/tools/metadata";
import { getTool } from "@/lib/tools/registry";

const tool = getTool("pdf-metadata-cleaner")!;
export const metadata = toolMetadata(tool);

export default function PdfMetadataCleanerPage() {
  return <ToolShell tool={tool}><PdfMetadataCleaner /></ToolShell>;
}
