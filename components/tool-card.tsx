import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { toolIcons } from "@/lib/tools/icons";
import type { ToolDefinition } from "@/lib/tools/registry";

export function ToolCard({ tool, index }: { tool: ToolDefinition; index?: number }) {
  const Icon = toolIcons[tool.icon];

  return (
    <Link href={`/tools/${tool.slug}`} className="tool-card group">
      <div className="flex items-start justify-between gap-4">
        <span className="tool-icon">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        {index !== undefined ? (
          <span className="text-xs font-medium text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
        ) : (
          <span className="text-xs font-medium text-muted-foreground">{tool.category}</span>
        )}
      </div>
      <div className="mt-8">
        <span className={tool.mode === "local" ? "mode-local" : "mode-external"}>
          {tool.mode === "local" ? "Processed locally" : "External lookup"}
        </span>
        <h3 className="mt-3 text-xl font-semibold tracking-[-0.025em]">{tool.name}</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{tool.description}</p>
      </div>
      <div className="mt-7 flex items-center gap-2 text-sm font-semibold text-primary">
        Open tool
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none" aria-hidden="true" />
      </div>
    </Link>
  );
}
