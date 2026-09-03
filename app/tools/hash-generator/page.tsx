import { HashGenerator } from "@/components/tools/hash-generator";
import { ToolShell } from "@/components/tool-shell";
import { toolMetadata } from "@/lib/tools/metadata";
import { getTool } from "@/lib/tools/registry";

const tool = getTool("hash-generator")!;

export const metadata = toolMetadata(tool);

export default function HashGeneratorPage() {
  return <ToolShell tool={tool}><HashGenerator /></ToolShell>;
}
