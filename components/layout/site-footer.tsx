import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/70">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-5 py-7 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>© {new Date().getFullYear()} NoTrak. Private tools, built in the open.</p>
        <div className="flex items-center gap-4">
          <Link href="/methodology" className="hover:text-foreground">Methodology</Link>
          <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link href="/tools" className="hover:text-foreground">All tools</Link>
        </div>
      </div>
    </footer>
  );
}
