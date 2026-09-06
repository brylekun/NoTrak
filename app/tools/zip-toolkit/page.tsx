import { ToolShell } from "@/components/tool-shell";
import { ZipToolkit } from "@/components/tools/zip-toolkit";
import { toolMetadata } from "@/lib/tools/metadata";
import { getTool } from "@/lib/tools/registry";

const tool = getTool("zip-toolkit")!;
export const metadata = toolMetadata(tool);

export default function ZipToolkitPage() {
  return <ToolShell tool={tool}><ZipToolkit /></ToolShell>;
}
