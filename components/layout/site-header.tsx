import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { ThemeToggle } from "@/components/layout/theme-toggle";

export function SiteHeader() {
  return (
    <header className="border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5" aria-label="NoTrak home">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_8px_24px_-10px_var(--primary)]">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </span>
          <span className="text-lg font-semibold tracking-[-0.03em]">NoTrak</span>
        </Link>

        <nav className="flex items-center gap-1 text-sm" aria-label="Main navigation">
          <Link className="nav-link" href="/#tools">Tools</Link>
          <Link className="nav-link hidden sm:inline-flex" href="/methodology">Methodology</Link>
          <Link className="nav-link" href="/privacy">Privacy</Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
