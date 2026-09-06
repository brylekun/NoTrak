import Link from "next/link";
import { Coins, HandCoins, Heart } from "lucide-react";

import { hasMoneroAddress, supportLinks } from "@/lib/support";

const ICONS = { "github-sponsors": Heart, paypal: HandCoins } as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-border/70 pb-[env(safe-area-inset-bottom,0px)]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 page-gutter py-7 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} NoTrak. Private tools, built in the open.</p>
        {/* `touch-row` gives these links a 44px tap height on phones without
            padding them apart on desktop, where they read as one line. */}
        <div className="touch-row flex flex-wrap items-center gap-x-4 gap-y-1 sm:gap-y-2">
          <Link href="/methodology" className="transition-colors hover:text-foreground motion-reduce:transition-none">Methodology</Link>
          <Link href="/privacy" className="transition-colors hover:text-foreground motion-reduce:transition-none">Privacy</Link>
          <Link href="/tools" className="transition-colors hover:text-foreground motion-reduce:transition-none">All tools</Link>

          {/* Plain outbound links. Funding carries no embedded widget, so
              nothing here contacts a provider until the visitor clicks. */}
          <span className="hidden h-3 w-px bg-border sm:inline-block" aria-hidden="true" />
          {supportLinks.map((link) => {
            const Icon = ICONS[link.id as keyof typeof ICONS] ?? Heart;
            return (
              <a
                key={link.id}
                href={link.href}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground motion-reduce:transition-none"
              >
                <Icon className="size-3.5" aria-hidden="true" />
                {link.label}
              </a>
            );
          })}
          {/* The Monero address lives on its own page because 95 characters
              cannot read well in a footer. The label names Monero only once an
              address is configured, so the link never leads to an empty
              section. Styled as the one emphasized footer action because it
              replaced the floating widget as the way to reach funding. */}
          <Link
            href="/support"
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/8 px-3 py-1.5 font-medium text-primary transition-colors hover:bg-primary/14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none"
          >
            <Coins className="size-3.5" aria-hidden="true" />
            {hasMoneroAddress ? "Monero" : "Support NoTrak"}
          </Link>
        </div>
      </div>
    </footer>
  );
}
