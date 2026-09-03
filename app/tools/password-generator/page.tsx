import { PasswordGenerator } from "@/components/tools/password-generator";
import { ToolShell } from "@/components/tool-shell";
import { toolMetadata } from "@/lib/tools/metadata";
import { getTool } from "@/lib/tools/registry";

const tool = getTool("password-generator")!;

export const metadata = toolMetadata(tool);

export default function PasswordGeneratorPage() {
  return <ToolShell tool={tool}><PasswordGenerator /></ToolShell>;
}
