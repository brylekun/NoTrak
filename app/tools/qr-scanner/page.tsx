import type { Metadata } from "next";
import { QrScanner } from "@/components/tools/qr-scanner";
import { ToolShell } from "@/components/tool-shell";
import { getTool } from "@/lib/tools/registry";
const tool = getTool("qr-scanner")!;
export const metadata: Metadata = { title: tool.name, description: tool.description };
export default function QrScannerPage() { return <ToolShell tool={tool}><QrScanner /></ToolShell>; }
