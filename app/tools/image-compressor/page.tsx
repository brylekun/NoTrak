import { ImageCompressor } from "@/components/tools/image-compressor";
import { ToolShell } from "@/components/tool-shell";
import { toolMetadata } from "@/lib/tools/metadata";
import { getTool } from "@/lib/tools/registry";

const tool = getTool("image-compressor")!;

export const metadata = toolMetadata(tool);

export default function ImageCompressorPage() {
  return <ToolShell tool={tool}><ImageCompressor /></ToolShell>;
}
