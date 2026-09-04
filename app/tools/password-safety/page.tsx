import { PasswordSafetyChecker } from "@/components/tools/password-safety-checker";
import { ToolShell } from "@/components/tool-shell";
import { toolMetadata } from "@/lib/tools/metadata";
import { getTool } from "@/lib/tools/registry";

const tool = getTool("password-safety")!;

export const metadata = toolMetadata(tool);

export default function PasswordSafetyPage() {
  return <ToolShell tool={tool}><PasswordSafetyChecker /></ToolShell>;
}
