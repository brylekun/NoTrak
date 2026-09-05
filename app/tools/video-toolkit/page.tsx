import { ToolShell } from "@/components/tool-shell";
import { VideoToolkit } from "@/components/tools/video-toolkit";
import { toolMetadata } from "@/lib/tools/metadata";
import { getTool } from "@/lib/tools/registry";

const tool = getTool("video-toolkit")!;
export const metadata = toolMetadata(tool);

export default function VideoToolkitPage() {
  return <ToolShell tool={tool}><VideoToolkit /></ToolShell>;
}
