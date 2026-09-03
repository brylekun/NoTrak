import type { Metadata } from "next";
import Link from "next/link";
import { CloudOff } from "lucide-react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { readyTools } from "@/lib/tools/registry";

export const metadata: Metadata = {
  title: "Offline",
  description: "NoTrak could not reach the network. Local tools you have already opened still work.",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  const localTools = readyTools.filter((tool) => tool.mode === "local");

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
          <span className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <CloudOff className="size-6" aria-hidden="true" />
          </span>
          <p className="eyebrow mt-6">Offline</p>
          <h1 className="mt-3 text-balance text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
            No network — and most tools do not need one.
          </h1>
          <p className="mt-5 text-base leading-7 text-muted-foreground">
            {localTools.length} of NoTrak&rsquo;s {readyTools.length} tools do all their work in your browser, so any of
            them you have opened before will still run. The connection checks and reputation lookups need the network and
            will wait.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/tools" className={cn(buttonVariants(), "h-10 px-4")}>
              Browse all tools
            </Link>
            <Link href="/" className={cn(buttonVariants({ variant: "outline" }), "h-10 px-4")}>
              Go home
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
