import type { Metadata } from "next";
import Link from "next/link";
import { Compass } from "lucide-react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Page not found",
  description: "That NoTrak page does not exist.",
};

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
          <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Compass className="size-6" aria-hidden="true" />
          </span>
          <p className="eyebrow mt-6">404</p>
          <h1 className="mt-3 text-balance text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
            That page does not exist.
          </h1>
          <p className="mt-5 text-base leading-7 text-muted-foreground">
            The link may be outdated or mistyped. No tool input was processed by this missing page.
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
