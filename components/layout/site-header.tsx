import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { SiteNavigation } from "@/components/layout/site-navigation";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/82 shadow-[0_8px_30px_-28px_color-mix(in_oklch,var(--foreground),transparent_55%)] backdrop-blur-xl">
      <div className="relative mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="group flex items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="NoTrak home">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_8px_24px_-10px_var(--primary)] transition-transform duration-200 ease-[var(--motion-ease-out)] group-hover:-rotate-3 group-hover:scale-[1.04] group-active:scale-[0.98] motion-reduce:transition-none">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </span>
          <span className="text-lg font-semibold tracking-[-0.03em]">NoTrak</span>
        </Link>

        <SiteNavigation />
      </div>
    </header>
  );
}
