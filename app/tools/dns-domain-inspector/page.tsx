import { ToolShell } from "@/components/tool-shell";
import { DnsDomainInspector } from "@/components/tools/dns-domain-inspector";
import { toolMetadata } from "@/lib/tools/metadata";
import { getTool } from "@/lib/tools/registry";

const tool = getTool("dns-domain-inspector")!;
export const metadata = toolMetadata(tool);

export default function DnsDomainInspectorPage() {
  return <ToolShell tool={tool}><DnsDomainInspector /></ToolShell>;
}
