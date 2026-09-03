import { TextEncryption } from "@/components/tools/text-encryption";
import { ToolShell } from "@/components/tool-shell";
import { toolMetadata } from "@/lib/tools/metadata";
import { getTool } from "@/lib/tools/registry";

const tool = getTool("text-encryption")!;

export const metadata = toolMetadata(tool);

export default function TextEncryptionPage() {
  return <ToolShell tool={tool}><TextEncryption /></ToolShell>;
}
