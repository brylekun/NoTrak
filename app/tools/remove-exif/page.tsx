import type { Metadata } from "next";

import { ExifRemover } from "@/components/tools/exif-remover";
import { ToolShell } from "@/components/tool-shell";
import { getTool } from "@/lib/tools/registry";

const tool = getTool("remove-exif")!;

export const metadata: Metadata = { title: tool.name, description: tool.description };

export default function ExifRemoverPage() {
  return <ToolShell tool={tool}><ExifRemover /></ToolShell>;
}
