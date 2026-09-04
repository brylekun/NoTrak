import { PdfToolkit } from "@/components/tools/pdf-toolkit";
import { ToolShell } from "@/components/tool-shell";
import { toolMetadata } from "@/lib/tools/metadata";
import { getTool } from "@/lib/tools/registry";

const tool = getTool("pdf-toolkit")!;
export const metadata = toolMetadata(tool);

export default function PdfToolkitPage() {
  return <ToolShell tool={tool}><PdfToolkit /></ToolShell>;
}
