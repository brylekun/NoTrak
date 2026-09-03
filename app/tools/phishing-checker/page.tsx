import { PhishingChecker } from "@/components/tools/phishing-checker";
import { ToolShell } from "@/components/tool-shell";
import { toolMetadata } from "@/lib/tools/metadata";
import { getTool } from "@/lib/tools/registry";

const tool = getTool("phishing-checker")!;
export const metadata = toolMetadata(tool);
export default function PhishingCheckerPage() { return <ToolShell tool={tool}><PhishingChecker /></ToolShell>; }
