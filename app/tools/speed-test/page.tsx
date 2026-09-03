import { SpeedTest } from "@/components/tools/speed-test";
import { ToolShell } from "@/components/tool-shell";
import { toolMetadata } from "@/lib/tools/metadata";
import { getTool } from "@/lib/tools/registry";

const tool = getTool("speed-test")!;
export const metadata = toolMetadata(tool);

export default function SpeedTestPage() {
  return <ToolShell tool={tool}><SpeedTest /></ToolShell>;
}
