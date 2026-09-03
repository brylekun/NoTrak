import type { Metadata } from "next";

import { FileEncryption } from "@/components/tools/file-encryption";
import { ToolShell } from "@/components/tool-shell";
import { getTool } from "@/lib/tools/registry";

const tool = getTool("file-encryption")!;
export const metadata: Metadata = { title: tool.name, description: tool.description };

export default function FileEncryptionPage() {
  return <ToolShell tool={tool}><FileEncryption /></ToolShell>;
}
