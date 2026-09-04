import { EmailHeaderAnalyzer } from "@/components/tools/email-header-analyzer";
import { ToolShell } from "@/components/tool-shell";
import { toolMetadata } from "@/lib/tools/metadata";
import { getTool } from "@/lib/tools/registry";

const tool = getTool("email-header-analyzer")!;

export const metadata = toolMetadata(tool);

export default function EmailHeaderAnalyzerPage() {
  return <ToolShell tool={tool}><EmailHeaderAnalyzer /></ToolShell>;
}
