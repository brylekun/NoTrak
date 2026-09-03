import { ToolShell } from "@/components/tool-shell";
import { UuidGenerator } from "@/components/tools/uuid-generator";
import { toolMetadata } from "@/lib/tools/metadata";
import { getTool } from "@/lib/tools/registry";

const tool = getTool("uuid-generator")!;

export const metadata = toolMetadata(tool);

export default function UuidGeneratorPage() {
  return <ToolShell tool={tool}><UuidGenerator /></ToolShell>;
}
