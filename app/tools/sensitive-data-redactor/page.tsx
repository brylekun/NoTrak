import { SensitiveDataRedactor } from "@/components/tools/sensitive-data-redactor";
import { ToolShell } from "@/components/tool-shell";
import { toolMetadata } from "@/lib/tools/metadata";
import { getTool } from "@/lib/tools/registry";

const tool = getTool("sensitive-data-redactor")!;

export const metadata = toolMetadata(tool);

export default function SensitiveDataRedactorPage() {
  return <ToolShell tool={tool}><SensitiveDataRedactor /></ToolShell>;
}
