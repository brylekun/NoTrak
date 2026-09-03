import type { Metadata } from "next";

import { BrowserPrivacyCheck } from "@/components/tools/browser-privacy-check";
import { ToolShell } from "@/components/tool-shell";
import { getTool } from "@/lib/tools/registry";

const tool = getTool("browser-privacy")!;
export const metadata: Metadata = { title: tool.name, description: tool.description };

export default function BrowserPrivacyPage() {
  return <ToolShell tool={tool}><BrowserPrivacyCheck /></ToolShell>;
}
