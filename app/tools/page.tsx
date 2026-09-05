import type { Metadata } from "next";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ToolBrowser } from "@/components/tool-browser";
import { readyTools, toolCategories } from "@/lib/tools/registry";

export const metadata: Metadata = {
  title: "All tools",
  description: `Browse all ${readyTools.length} NoTrak privacy tools by category. Local tools process on your device; network checks state exactly what they send.`,
  alternates: { canonical: "/tools" },
};

export default function ToolsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="flex-1">
        <div className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
          <div className="motion-reveal">
            <p className="eyebrow">All tools</p>
            <h1 className="mt-3 max-w-3xl text-balance text-4xl font-semibold tracking-[-0.05em] sm:text-6xl">
              {readyTools.length} tools. One privacy rule.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              Every tool labels how it handles your data. Local tools never send your input anywhere. Network checks name
              exactly what leaves your device before you run them.
            </p>
          </div>

          <div className="motion-reveal motion-delay-1 mt-12">
            <ToolBrowser tools={readyTools} categories={toolCategories} />
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
