import type { Metadata } from "next";

import { SpeedTest } from "@/components/tools/speed-test";
import { ToolShell } from "@/components/tool-shell";
import { getTool } from "@/lib/tools/registry";

const tool = getTool("speed-test")!;
export const metadata: Metadata = { title: tool.name, description: tool.description };

export default function SpeedTestPage() {
  return <ToolShell tool={tool}><SpeedTest /></ToolShell>;
}
