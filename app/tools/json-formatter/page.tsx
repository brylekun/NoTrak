import { JsonFormatter } from "@/components/tools/json-formatter";
import { ToolShell } from "@/components/tool-shell";
import { toolMetadata } from "@/lib/tools/metadata";
import { getTool } from "@/lib/tools/registry";

const tool = getTool("json-formatter")!;

export const metadata = toolMetadata(tool);

export default function JsonFormatterPage() {
  return <ToolShell tool={tool}><JsonFormatter /></ToolShell>;
}
