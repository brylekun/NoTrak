import { PassphraseGenerator } from "@/components/tools/passphrase-generator";
import { ToolShell } from "@/components/tool-shell";
import { toolMetadata } from "@/lib/tools/metadata";
import { getTool } from "@/lib/tools/registry";

const tool = getTool("passphrase-generator")!;

export const metadata = toolMetadata(tool);

export default function PassphraseGeneratorPage() {
  return <ToolShell tool={tool}><PassphraseGenerator /></ToolShell>;
}
