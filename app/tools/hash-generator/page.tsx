import type { Metadata } from "next";

import { HashGenerator } from "@/components/tools/hash-generator";
import { ToolShell } from "@/components/tool-shell";
import { getTool } from "@/lib/tools/registry";

const tool = getTool("hash-generator")!;

export const metadata: Metadata = { title: tool.name, description: tool.description };

export default function HashGeneratorPage() {
  return <ToolShell tool={tool}><HashGenerator /></ToolShell>;
}
