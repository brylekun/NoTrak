import type { Metadata } from "next";

import { TrackingUrlCleaner } from "@/components/tools/tracking-url-cleaner";
import { ToolShell } from "@/components/tool-shell";
import { getTool } from "@/lib/tools/registry";

const tool = getTool("tracking-url-cleaner")!;

export const metadata: Metadata = {
  title: tool.name,
  description: tool.description,
};

export default function TrackingUrlCleanerPage() {
  return <ToolShell tool={tool}><TrackingUrlCleaner /></ToolShell>;
}
