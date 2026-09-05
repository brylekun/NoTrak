"use client";

import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Error details are intentionally not rendered or reported. A tool error can
// carry a filename, URL, or hash, and NoTrak does not surface or transmit those.
export default function ErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
          <span className="grid size-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
            <AlertTriangle className="size-6" aria-hidden="true" />
          </span>
          <p className="eyebrow mt-6">Something went wrong</p>
          <h1 className="mt-3 text-balance text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
            This tool stopped unexpectedly.
          </h1>
          <p className="mt-5 text-base leading-7 text-muted-foreground">
            NoTrak did not send an application error report or include your tool input on this screen. If this tool
            performs an external lookup, any request that already started follows the disclosure shown before you ran
            it. Retrying clears the tool&rsquo;s state, so you may need to select a file or re-enter text.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button className="h-10 px-4" onClick={reset}>
              <RotateCcw /> Try again
            </Button>
            <Link href="/tools" className={cn(buttonVariants({ variant: "outline" }), "h-10 px-4")}>
              Browse all tools
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
