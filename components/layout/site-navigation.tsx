"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/tools", label: "Tools", includesChildren: true },
  { href: "/methodology", label: "Methodology", includesChildren: false },
  { href: "/privacy", label: "Privacy", includesChildren: false },
];

function isCurrentPath(pathname: string, href: string, includesChildren: boolean) {
  return pathname === href || (includesChildren && pathname.startsWith(`${href}/`));
}

export function SiteNavigation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      menuButton.current?.focus();
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <div className="flex items-center gap-1">
      <nav className="hidden items-center gap-1 text-sm sm:flex" aria-label="Main navigation">
        {navigation.map((item) => {
          const current = isCurrentPath(pathname, item.href, item.includesChildren);
          return (
            <Link
              key={item.href}
              className={cn("nav-link", current && "nav-link-active")}
              href={item.href}
              aria-current={current ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <ThemeToggle />

      <Button
        ref={menuButton}
        type="button"
        variant="ghost"
        size="icon"
        className="sm:hidden"
        aria-label={open ? "Close navigation" : "Open navigation"}
        aria-expanded={open}
        aria-controls="site-mobile-navigation"
        onClick={() => setOpen((current) => !current)}
      >
        {open ? <X className="size-4" aria-hidden="true" /> : <Menu className="size-4" aria-hidden="true" />}
      </Button>

      {open && (
        <nav
          id="site-mobile-navigation"
          aria-label="Mobile navigation"
          className="mobile-nav-panel absolute inset-x-5 top-[calc(100%+0.5rem)] z-50 rounded-2xl border border-border/80 bg-popover p-2 text-sm text-popover-foreground shadow-2xl sm:hidden"
        >
          {navigation.map((item) => {
            const current = isCurrentPath(pathname, item.href, item.includesChildren);
            return (
              <Link
                key={item.href}
                className={cn("nav-link flex w-full items-center justify-between", current && "nav-link-active")}
                href={item.href}
                aria-current={current ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                {item.label}
                {current && <span className="text-xs text-primary">Current</span>}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
