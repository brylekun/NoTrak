import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { PrivacyNotice } from "@/components/privacy-notice";
import type { ToolDefinition } from "@/lib/tools/registry";

export function ToolShell({ tool, children }: { tool: ToolDefinition; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
          <Link href="/tools" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" aria-hidden="true" />
            All tools
          </Link>

          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
            <div className="min-w-0">
              <span className={tool.mode === "local" ? "mode-local" : "mode-external"}>
                {tool.mode === "local" ? "Processed locally" : "External lookup"}
              </span>
              <h1 className="mt-4 text-balance text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">{tool.name}</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">{tool.description}</p>

              <div className="mt-8 rounded-3xl border border-border/80 bg-card p-5 shadow-[0_22px_70px_-52px_color-mix(in_oklch,var(--foreground),transparent_35%)] sm:p-7">
                {children}
              </div>
            </div>

            <aside className="min-w-0 lg:sticky lg:top-8">
              <PrivacyNotice mode={tool.mode}>{tool.privacyNotice}</PrivacyNotice>
              <div className="mt-4 rounded-2xl border border-border/70 p-4 text-sm text-muted-foreground">
                <p className="font-semibold text-foreground">NoTrak rule</p>
                <p className="mt-1 leading-6">No accounts, saved history, advertising trackers, or cloud file storage.</p>
              </div>
            </aside>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
