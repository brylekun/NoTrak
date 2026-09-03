import { IpChecker } from "@/components/tools/ip-checker";
import { ToolShell } from "@/components/tool-shell";
import { toolMetadata } from "@/lib/tools/metadata";
import { getTool } from "@/lib/tools/registry";

const tool = getTool("whats-my-ip")!;

export const metadata = toolMetadata(tool);

export default function WhatsMyIpPage() {
  return <ToolShell tool={tool}><IpChecker /></ToolShell>;
}
