import type { Metadata } from "next";

import { ImageCompressor } from "@/components/tools/image-compressor";
import { ToolShell } from "@/components/tool-shell";
import { getTool } from "@/lib/tools/registry";

const tool = getTool("image-compressor")!;

export const metadata: Metadata = { title: tool.name, description: tool.description };

export default function ImageCompressorPage() {
  return <ToolShell tool={tool}><ImageCompressor /></ToolShell>;
}
