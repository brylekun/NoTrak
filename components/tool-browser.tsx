"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

import { ToolCard } from "@/components/tool-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ToolCategory, ToolDefinition } from "@/lib/tools/registry";

type Filter = ToolCategory | "All";

export function ToolBrowser({ tools, categories }: { tools: ToolDefinition[]; categories: ToolCategory[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("All");

  const filters: Filter[] = useMemo(() => ["All", ...categories], [categories]);

  const counts = useMemo(() => {
    const totals = new Map<Filter, number>([["All", tools.length]]);
    for (const tool of tools) totals.set(tool.category, (totals.get(tool.category) ?? 0) + 1);
    return totals;
  }, [tools]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tools.filter((tool) => {
      if (filter !== "All" && tool.category !== filter) return false;
      if (!needle) return true;
      return `${tool.name} ${tool.description} ${tool.category}`.toLowerCase().includes(needle);
    });
  }, [tools, query, filter]);

  const hasFilters = query.trim().length > 0 || filter !== "All";

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            className="h-11 pl-9"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tools"
            aria-label="Search tools by name or description"
          />
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter tools by category">
          {filters.map((item) => {
            const active = filter === item;
            return (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                aria-pressed={active}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/70 text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {item}
                <span className={cn("text-xs", active ? "text-primary-foreground/75" : "text-muted-foreground/70")}>
                  {counts.get(item) ?? 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-6 text-sm text-muted-foreground" role="status" aria-live="polite">
        {visible.length === tools.length
          ? `Showing all ${tools.length} tools.`
          : `Showing ${visible.length} of ${tools.length} tools.`}
      </p>

      {visible.length > 0 ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((tool) => (
            <ToolCard key={tool.slug} tool={tool} />
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-3xl border border-dashed border-border/80 p-10 text-center">
          <p className="font-semibold">No tools match that search.</p>
          <p className="mt-2 text-sm text-muted-foreground">Try a shorter term, or clear the filters to see everything.</p>
        </div>
      )}

      {hasFilters && (
        <div className="mt-6">
          <Button
            className="h-10 px-4"
            variant="outline"
            onClick={() => {
              setQuery("");
              setFilter("All");
            }}
          >
            <X /> Clear filters
          </Button>
        </div>
      )}
    </div>
  );
}
