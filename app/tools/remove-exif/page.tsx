import { ExifRemover } from "@/components/tools/exif-remover";
import { ToolShell } from "@/components/tool-shell";
import { toolMetadata } from "@/lib/tools/metadata";
import { getTool } from "@/lib/tools/registry";

const tool = getTool("remove-exif")!;

export const metadata = toolMetadata(tool);

export default function ExifRemoverPage() {
  return <ToolShell tool={tool}><ExifRemover /></ToolShell>;
}
