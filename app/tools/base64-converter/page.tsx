import { Base64Converter } from "@/components/tools/base64-converter";
import { ToolShell } from "@/components/tool-shell";
import { toolMetadata } from "@/lib/tools/metadata";
import { getTool } from "@/lib/tools/registry";

const tool = getTool("base64-converter")!;

export const metadata = toolMetadata(tool);

export default function Base64ConverterPage() {
  return <ToolShell tool={tool}><Base64Converter /></ToolShell>;
}
