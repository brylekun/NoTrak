import { BrowserPrivacyCheck } from "@/components/tools/browser-privacy-check";
import { ToolShell } from "@/components/tool-shell";
import { toolMetadata } from "@/lib/tools/metadata";
import { getTool } from "@/lib/tools/registry";

const tool = getTool("browser-privacy")!;
export const metadata = toolMetadata(tool);

export default function BrowserPrivacyPage() {
  return <ToolShell tool={tool}><BrowserPrivacyCheck /></ToolShell>;
}
