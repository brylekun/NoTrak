import { QrScanner } from "@/components/tools/qr-scanner";
import { ToolShell } from "@/components/tool-shell";
import { toolMetadata } from "@/lib/tools/metadata";
import { getTool } from "@/lib/tools/registry";

const tool = getTool("qr-scanner")!;
export const metadata = toolMetadata(tool);
export default function QrScannerPage() { return <ToolShell tool={tool}><QrScanner /></ToolShell>; }
