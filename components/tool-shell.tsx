import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { PrivacyNotice } from "@/components/privacy-notice";
import { JsonLd } from "@/components/seo/json-ld";
import { toolBreadcrumbStructuredData } from "@/lib/seo/structured-data";
import { getToolGuide } from "@/lib/tools/guides";
import { getTool, type ToolDefinition } from "@/lib/tools/registry";

export function ToolShell({ tool, children, wide = false }: { tool: ToolDefinition; children: React.ReactNode; wide?: boolean }) {
  const guide = getToolGuide(tool.slug);
  const relatedTools = guide.relatedSlugs.map((slug) => getTool(slug)).filter((entry) => entry !== undefined);

  return (
    <div className="flex min-h-screen flex-col">
      <JsonLd data={toolBreadcrumbStructuredData(tool)} />
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="flex-1">
        <div className={`mx-auto w-full ${wide ? "max-w-7xl" : "max-w-5xl"} px-5 py-8 sm:px-8 sm:py-12`}>
          <Link href="/tools" className="motion-reveal inline-flex items-center gap-2 rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none">
            <ArrowLeft className="size-4" aria-hidden="true" />
            All tools
          </Link>

          <div className={`mt-8 grid gap-8 ${wide ? "" : "lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start"}`}>
            <div className="motion-reveal motion-delay-1 min-w-0">
              <span className={tool.mode === "local" ? "mode-local" : "mode-external"}>
                {tool.mode === "local" ? "Processed locally" : "External lookup"}
              </span>
              <h1 className="mt-4 text-balance text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">{tool.name}</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">{tool.description}</p>

              <div className="mt-8 rounded-3xl border border-border/80 bg-card p-5 shadow-[0_22px_70px_-52px_color-mix(in_oklch,var(--foreground),transparent_35%)] transition-shadow duration-300 hover:shadow-[0_28px_80px_-55px_color-mix(in_oklch,var(--primary),transparent_50%)] motion-reduce:transition-none sm:p-7">
                {children}
              </div>
            </div>

            <aside className={`${wide ? "grid min-w-0 gap-4 sm:grid-cols-2" : "min-w-0 lg:sticky lg:top-24"} motion-reveal motion-delay-2`}>
              <PrivacyNotice mode={tool.mode}>{tool.privacyNotice}</PrivacyNotice>
              <div className={`${wide ? "" : "mt-4"} rounded-2xl border border-border/70 p-4 text-sm text-muted-foreground`}>
                <p className="font-semibold text-foreground">NoTrak rule</p>
                <p className="mt-1 leading-6">No accounts, saved history, advertising trackers, or cloud file storage.</p>
              </div>
            </aside>
          </div>

          <section aria-labelledby="about-this-tool" className="motion-reveal mt-12 border-t border-border/70 pt-10 sm:mt-16 sm:pt-12">
            <p className="eyebrow">Practical guide</p>
            <h2 id="about-this-tool" className="mt-2 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
              About {tool.name}
            </h2>
            <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">{guide.summary}</p>

            <div className="mt-7 grid gap-4 md:grid-cols-2">
              <article className="rounded-2xl border border-border/70 bg-card/70 p-5">
                <h3 className="font-semibold">When to use it</h3>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                  {guide.useCases.map((useCase) => (
                    <li key={useCase} className="flex gap-2">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                      <span>{useCase}</span>
                    </li>
                  ))}
                </ul>
              </article>
              <article className="rounded-2xl border border-border/70 bg-card/70 p-5">
                <h3 className="font-semibold">How it works</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{guide.howItWorks}</p>
              </article>
              <article className="rounded-2xl border border-border/70 bg-card/70 p-5">
                <h3 className="font-semibold">Privacy boundary</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{tool.privacyNotice}</p>
              </article>
              <article className="rounded-2xl border border-border/70 bg-card/70 p-5">
                <h3 className="font-semibold">Know the limits</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{guide.limitations}</p>
              </article>
            </div>

            <div className="mt-8">
              <h3 className="font-semibold">Related privacy tools</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {relatedTools.map((related) => (
                  <Link
                    key={related.slug}
                    href={`/tools/${related.slug}`}
                    className="group inline-flex items-center gap-2 rounded-full border border-border/80 bg-card px-3 py-2 text-sm font-medium transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {related.name}
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
                  </Link>
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
