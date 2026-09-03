import type { Metadata } from "next";

import { QrGenerator } from "@/components/tools/qr-generator";
import { ToolShell } from "@/components/tool-shell";
import { getTool } from "@/lib/tools/registry";

const tool = getTool("qr-generator")!;

export const metadata: Metadata = { title: tool.name, description: tool.description };

export default function QrGeneratorPage() {
  return <ToolShell tool={tool}><QrGenerator /></ToolShell>;
}
