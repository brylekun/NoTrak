import type { Metadata } from "next";

import { PassphraseGenerator } from "@/components/tools/passphrase-generator";
import { ToolShell } from "@/components/tool-shell";
import { getTool } from "@/lib/tools/registry";

const tool = getTool("passphrase-generator")!;

export const metadata: Metadata = { title: tool.name, description: tool.description };

export default function PassphraseGeneratorPage() {
  return <ToolShell tool={tool}><PassphraseGenerator /></ToolShell>;
}
