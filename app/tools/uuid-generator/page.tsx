import type { Metadata } from "next";

import { ToolShell } from "@/components/tool-shell";
import { UuidGenerator } from "@/components/tools/uuid-generator";
import { getTool } from "@/lib/tools/registry";

const tool = getTool("uuid-generator")!;

export const metadata: Metadata = { title: tool.name, description: tool.description };

export default function UuidGeneratorPage() {
  return <ToolShell tool={tool}><UuidGenerator /></ToolShell>;
}
