import Link from "next/link";
import { Coins, HandCoins, Heart } from "lucide-react";

import { hasMoneroAddress, supportLinks } from "@/lib/support";

const ICONS = { "github-sponsors": Heart, paypal: HandCoins } as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-border/70">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-5 py-7 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>© {new Date().getFullYear()} NoTrak. Private tools, built in the open.</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link href="/methodology" className="hover:text-foreground">Methodology</Link>
          <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link href="/tools" className="hover:text-foreground">All tools</Link>

          {/* Plain outbound links; the global donation widget lives in the root layout. */}
          <span className="hidden h-3 w-px bg-border sm:inline-block" aria-hidden="true" />
          {supportLinks.map((link) => {
            const Icon = ICONS[link.id as keyof typeof ICONS] ?? Heart;
            return (
              <a
                key={link.id}
                href={link.href}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 hover:text-foreground"
              >
                <Icon className="size-3.5" aria-hidden="true" />
                {link.label}
              </a>
            );
          })}
          {/* The address lives on its own page because 95 characters cannot read
              well in a footer. The label names Monero only once an address is
              actually configured, so the link never leads to an empty section. */}
          <Link href="/support" className="inline-flex items-center gap-1.5 hover:text-foreground">
            <Coins className="size-3.5" aria-hidden="true" />
            {hasMoneroAddress ? "Monero" : "Support"}
          </Link>
        </div>
      </div>
    </footer>
  );
}
