import { AudioToolkit } from "@/components/tools/audio-toolkit";
import { ToolShell } from "@/components/tool-shell";
import { toolMetadata } from "@/lib/tools/metadata";
import { getTool } from "@/lib/tools/registry";

const tool = getTool("audio-toolkit")!;
export const metadata = toolMetadata(tool);

export default function AudioToolkitPage() {
  return <ToolShell tool={tool}><AudioToolkit /></ToolShell>;
}
