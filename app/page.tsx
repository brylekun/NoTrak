import Link from "next/link";
import {
  ArrowRight,
  Braces,
  Fingerprint,
  KeyRound,
  Link2Off,
  LockKeyhole,
  ScanSearch,
  Sparkles,
} from "lucide-react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { featuredTools, toolRegistry } from "@/lib/tools/registry";

const toolIcons = {
  fingerprint: Fingerprint,
  key: KeyRound,
  "link-off": Link2Off,
  braces: Braces,
  lock: LockKeyhole,
  scan: ScanSearch,
} as const;

export default function Home() {
  const upcomingTools = toolRegistry.filter((tool) => tool.status === "planned").slice(0, 3);

  return (
    <div className="min-h-screen overflow-hidden">
      <SiteHeader />

      <main>
        <section className="relative border-b border-border/70">
          <div className="ambient-grid" aria-hidden="true" />
          <div className="relative mx-auto grid w-full max-w-7xl gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:py-24">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1.5 text-xs font-semibold text-primary">
                <span className="size-1.5 rounded-full bg-primary shadow-[0_0_0_4px_color-mix(in_oklch,var(--primary),transparent_82%)]" />
                Privacy-first by design
              </div>
              <h1 className="max-w-3xl text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
                Useful tools.
                <span className="block text-primary">No trail.</span>
              </h1>
              <p className="mt-6 max-w-2xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
                Clean links, check your connection, and create strong passwords without handing over your files or building a profile.
              </p>
            </div>

            <div className="privacy-panel">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Sparkles className="size-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-semibold">The NoTrak promise</p>
                  <p className="text-xs text-muted-foreground">Clear boundaries on every tool.</p>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                {[
                  ["No", "accounts"],
                  ["No", "file uploads"],
                  ["No", "saved history"],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-xl border border-border/70 bg-background/65 px-2 py-3">
                    <p className="text-sm font-semibold text-primary">{value}</p>
                    <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="tools" className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
          <div className="mb-7 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow">Start here</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">Everyday privacy tools</h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-muted-foreground">
              Local tools stay on your device. Network checks show exactly what they send.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {featuredTools.map((tool, index) => {
              const Icon = toolIcons[tool.icon];
              return (
                <Link key={tool.slug} href={`/tools/${tool.slug}`} className="tool-card group">
                  <div className="flex items-start justify-between gap-4">
                    <span className="tool-icon">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
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
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                  </div>
                </Link>
              );
            })}
          </div>

          {upcomingTools.length > 0 && <div className="mt-12 border-t border-border/70 pt-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="eyebrow">Coming next</p>
                <h2 className="mt-2 text-xl font-semibold tracking-[-0.025em]">More tools, same privacy rules</h2>
              </div>
              <span className="hidden rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground sm:inline-flex">
                {toolRegistry.length} tools in the roadmap
              </span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {upcomingTools.map((tool) => {
                const Icon = toolIcons[tool.icon];
                return (
                  <div key={tool.slug} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/60 p-4">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{tool.name}</p>
                      <p className="text-xs text-muted-foreground">{tool.category}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
