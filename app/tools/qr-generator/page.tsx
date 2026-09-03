import { QrGenerator } from "@/components/tools/qr-generator";
import { ToolShell } from "@/components/tool-shell";
import { toolMetadata } from "@/lib/tools/metadata";
import { getTool } from "@/lib/tools/registry";

const tool = getTool("qr-generator")!;

export const metadata = toolMetadata(tool);

export default function QrGeneratorPage() {
  return <ToolShell tool={tool}><QrGenerator /></ToolShell>;
}
