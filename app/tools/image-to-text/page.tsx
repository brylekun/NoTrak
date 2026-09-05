import { ImageToText } from "@/components/tools/image-to-text";
import { ToolShell } from "@/components/tool-shell";
import { toolMetadata } from "@/lib/tools/metadata";
import { getTool } from "@/lib/tools/registry";

const tool = getTool("image-to-text")!;

export const metadata = toolMetadata(tool);

export default function ImageToTextPage() {
  return <ToolShell tool={tool}><ImageToText /></ToolShell>;
}
