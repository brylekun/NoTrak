import type { Metadata } from "next";
import { PhishingChecker } from "@/components/tools/phishing-checker";
import { ToolShell } from "@/components/tool-shell";
import { getTool } from "@/lib/tools/registry";
const tool = getTool("phishing-checker")!;
export const metadata: Metadata = { title: tool.name, description: tool.description };
export default function PhishingCheckerPage() { return <ToolShell tool={tool}><PhishingChecker /></ToolShell>; }
