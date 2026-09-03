import { FileEncryption } from "@/components/tools/file-encryption";
import { ToolShell } from "@/components/tool-shell";
import { toolMetadata } from "@/lib/tools/metadata";
import { getTool } from "@/lib/tools/registry";

const tool = getTool("file-encryption")!;
export const metadata = toolMetadata(tool);

export default function FileEncryptionPage() {
  return <ToolShell tool={tool}><FileEncryption /></ToolShell>;
}
