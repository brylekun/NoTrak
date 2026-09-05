import { ResumeBuilder } from "@/components/tools/resume-builder";
import { ToolShell } from "@/components/tool-shell";
import { toolMetadata } from "@/lib/tools/metadata";
import { getTool } from "@/lib/tools/registry";

const tool = getTool("resume-builder")!;
export const metadata = toolMetadata(tool);

export default function ResumeBuilderPage() {
  return <ToolShell tool={tool} wide><ResumeBuilder /></ToolShell>;
}
