import { DocumentScanner } from "@/components/tools/document-scanner";
import { ToolShell } from "@/components/tool-shell";
import { toolMetadata } from "@/lib/tools/metadata";
import { getTool } from "@/lib/tools/registry";

const tool = getTool("document-scanner")!;
export const metadata = toolMetadata(tool);

export default function DocumentScannerPage() {
  return <ToolShell tool={tool}><DocumentScanner /></ToolShell>;
}
