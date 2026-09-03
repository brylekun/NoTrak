import type { Metadata } from "next";

import { IpChecker } from "@/components/tools/ip-checker";
import { ToolShell } from "@/components/tool-shell";
import { getTool } from "@/lib/tools/registry";

const tool = getTool("whats-my-ip")!;

export const metadata: Metadata = {
  title: tool.name,
  description: tool.description,
};

export default function WhatsMyIpPage() {
  return <ToolShell tool={tool}><IpChecker /></ToolShell>;
}
