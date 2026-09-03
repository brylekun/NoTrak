import { ExifViewer } from "@/components/tools/exif-viewer";
import { ToolShell } from "@/components/tool-shell";
import { toolMetadata } from "@/lib/tools/metadata";
import { getTool } from "@/lib/tools/registry";

const tool = getTool("exif-viewer")!;

export const metadata = toolMetadata(tool);

export default function ExifViewerPage() {
  return <ToolShell tool={tool}><ExifViewer /></ToolShell>;
}
