"use client";

import { useMemo, useState } from "react";
import { Search, SearchX, X } from "lucide-react";

import { ToolCard } from "@/components/tool-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ToolCategory, ToolDefinition } from "@/lib/tools/registry";

type Filter = ToolCategory | "All";

export function ToolBrowser({ tools, categories }: { tools: ToolDefinition[]; categories: ToolCategory[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  // Latches on the first search or filter change and never resets, so the
  // entrance animation plays once per page load.
  const [interacted, setInteracted] = useState(false);

  const filters: Filter[] = useMemo(() => ["All", ...categories], [categories]);

  function clearFilters() {
    setInteracted(true);
    setQuery("");
    setFilter("All");
  }

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
            onChange={(event) => { setInteracted(true); setQuery(event.target.value); }}
            placeholder="Search tools"
            aria-label="Search tools by name or description"
          />
        </div>

        <div className="scroll-strip" role="group" aria-label="Filter tools by category">
          {filters.map((item) => {
            const active = filter === item;
            return (
              <button
                key={item}
                type="button"
                onClick={() => { setInteracted(true); setFilter(item); }}
                aria-pressed={active}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition-[transform,background-color,border-color,color] duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none motion-reduce:active:transform-none sm:px-3",
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
        // The staggered entrance belongs to the first paint only. Re-running it
        // on every keystroke reads as lag rather than polish, so the class is
        // dropped once the visitor starts filtering.
        <div className={cn("mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3", !interacted && "motion-grid")}>
          {visible.map((tool) => (
            <ToolCard key={tool.slug} tool={tool} />
          ))}
        </div>
      ) : (
        <div className="result-enter mt-5 rounded-3xl border border-dashed border-border/80 p-10 text-center">
          <span className="mx-auto grid size-11 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <SearchX className="size-5" aria-hidden="true" />
          </span>
          <p className="mt-4 font-semibold">No tools match that search.</p>
          <p className="mt-2 text-sm text-muted-foreground">Try a shorter term, or clear the filters to see everything.</p>
          <Button className="mt-5 h-10 px-4" variant="outline" onClick={clearFilters}>
            <X aria-hidden="true" /> Clear filters
          </Button>
        </div>
      )}

      {/* The button repeats below the grid only when there are results; the
          empty state carries its own copy so the recovery action is in reach. */}
      {hasFilters && visible.length > 0 && (
        <div className="mt-6">
          <Button className="h-10 px-4" variant="outline" onClick={clearFilters}>
            <X aria-hidden="true" /> Clear filters
          </Button>
        </div>
      )}
    </div>
  );
}
