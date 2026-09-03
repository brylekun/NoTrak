import type { Metadata } from "next";

import { PasswordGenerator } from "@/components/tools/password-generator";
import { ToolShell } from "@/components/tool-shell";
import { getTool } from "@/lib/tools/registry";

const tool = getTool("password-generator")!;

export const metadata: Metadata = {
  title: tool.name,
  description: tool.description,
};

export default function PasswordGeneratorPage() {
  return <ToolShell tool={tool}><PasswordGenerator /></ToolShell>;
}
