import { ImageConverter } from "@/components/tools/image-converter";
import { ToolShell } from "@/components/tool-shell";
import { toolMetadata } from "@/lib/tools/metadata";
import { getTool } from "@/lib/tools/registry";

const tool = getTool("image-converter")!;
export const metadata = toolMetadata(tool);
export default function ImageConverterPage() { return <ToolShell tool={tool}><ImageConverter /></ToolShell>; }
