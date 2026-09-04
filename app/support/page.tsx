import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { MoneroAddress } from "@/components/monero-address";
import { Button } from "@/components/ui/button";
import { hasMoneroAddress, moneroAddress, supportLinks } from "@/lib/support";

export const metadata: Metadata = {
  title: "Support NoTrak",
  description: "Ways to fund NoTrak's development. No tracking pixels, badge images, or payment widgets are embedded.",
  alternates: { canonical: "/support" },
};

export default function SupportPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
          <p className="eyebrow">Support</p>
          <h1 className="mt-3 text-balance text-4xl font-semibold tracking-[-0.05em] sm:text-6xl">
            Keep NoTrak free and unfunded by tracking.
          </h1>
          <p className="mt-5 text-base leading-7 text-muted-foreground sm:text-lg">
            NoTrak carries no advertising, no analytics, and no affiliate links, which means it has no revenue. If it
            saved you a step, contributing covers the domain and hosting. Nothing here is required, and no feature is
            withheld behind a payment.
          </p>

          <div className="callout-info mt-8">
            <strong>This page embeds nothing.</strong> The options below are plain outbound links. No badge image,
            payment widget, or script from a funding platform loads on any NoTrak page, so simply reading this costs you
            no request to a third party. A platform learns about you only if you choose to open it.
          </div>

          <div className="mt-10 space-y-4">
            {supportLinks.map((link) => (
              <section key={link.id} className="rounded-3xl border border-border/80 bg-card p-6">
                <h2 className="text-lg font-semibold tracking-[-0.025em]">{link.label}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{link.detail}</p>
                <Button
                  className="mt-4 h-10 px-4"
                  nativeButton={false}
                  render={<a href={link.href} target="_blank" rel="noreferrer noopener" />}
                >
                  Open {link.label}
                  <ExternalLink aria-hidden="true" />
                </Button>
              </section>
            ))}

            {hasMoneroAddress && (
              <section className="rounded-3xl border border-border/80 bg-card p-6">
                <h2 className="text-lg font-semibold tracking-[-0.025em]">Monero</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Direct wallet-to-wallet, with no payment processor between us. This is the only option that involves
                  no third party at all.
                </p>
                <div className="mt-5">
                  <MoneroAddress address={moneroAddress} />
                </div>
              </section>
            )}
          </div>

          <p className="mt-10 text-sm leading-6 text-muted-foreground">
            Contributions are gifts, not purchases. They buy no support commitment, no priority on a tool request, and
            no influence over what NoTrak will or will not send over the network.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
