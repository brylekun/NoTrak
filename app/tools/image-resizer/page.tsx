import { ImageResizer } from "@/components/tools/image-resizer";
import { ToolShell } from "@/components/tool-shell";
import { toolMetadata } from "@/lib/tools/metadata";
import { getTool } from "@/lib/tools/registry";

const tool = getTool("image-resizer")!;

export const metadata = toolMetadata(tool);

export default function ImageResizerPage() {
  return <ToolShell tool={tool}><ImageResizer /></ToolShell>;
}
