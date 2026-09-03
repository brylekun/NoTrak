import { TrackingUrlCleaner } from "@/components/tools/tracking-url-cleaner";
import { ToolShell } from "@/components/tool-shell";
import { toolMetadata } from "@/lib/tools/metadata";
import { getTool } from "@/lib/tools/registry";

const tool = getTool("tracking-url-cleaner")!;

export const metadata = toolMetadata(tool);

export default function TrackingUrlCleanerPage() {
  return <ToolShell tool={tool}><TrackingUrlCleaner /></ToolShell>;
}
