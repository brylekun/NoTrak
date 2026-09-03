import type { Metadata } from "next";
import { ImageConverter } from "@/components/tools/image-converter";
import { ToolShell } from "@/components/tool-shell";
import { getTool } from "@/lib/tools/registry";
const tool = getTool("image-converter")!;
export const metadata: Metadata = { title: tool.name, description: tool.description };
export default function ImageConverterPage() { return <ToolShell tool={tool}><ImageConverter /></ToolShell>; }
