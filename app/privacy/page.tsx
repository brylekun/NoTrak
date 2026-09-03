import type { Metadata } from "next";
import { CheckCircle2, Cloud, HardDrive, Server } from "lucide-react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How NoTrak keeps processing local and clearly labels every external request.",
};

const principles = [
  {
    icon: HardDrive,
    title: "Your device does the work",
    body: "Passwords, links, files, encryption keys, and local tool results stay in your browser unless a tool clearly says it performs an external lookup.",
  },
  {
    icon: Server,
    title: "No NoTrak database",
    body: "NoTrak has no accounts, profiles, saved tool history, or application database. Sensitive tool inputs are not stored in browser storage. Only your harmless light or dark theme preference is saved locally.",
  },
  {
    icon: Cloud,
    title: "External checks are explicit",
    body: "A network or reputation tool names the information it sends before you use it. Local-only tools do not send processing requests.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
          <p className="eyebrow">Privacy</p>
          <h1 className="mt-3 max-w-3xl text-balance text-4xl font-semibold tracking-[-0.05em] sm:text-6xl">
            You should know exactly where your data goes.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            NoTrak is designed around a simple boundary: process on your device whenever possible, and explain every exception.
          </p>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {principles.map(({ icon: Icon, title, body }) => (
              <section key={title} className="rounded-3xl border border-border/80 bg-card p-6">
                <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h2 className="mt-6 text-lg font-semibold tracking-[-0.025em]">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
              </section>
            ))}
          </div>

          <div className="mt-10 grid gap-8 rounded-3xl border border-border/80 bg-card p-6 sm:p-8 lg:grid-cols-2">
            <section>
              <h2 className="text-xl font-semibold tracking-[-0.03em]">What NoTrak does not collect</h2>
              <ul className="mt-5 space-y-3">
                {["Accounts or personal profiles", "Uploaded copies of your files", "Passwords or encryption keys", "Saved tool history", "Advertising or cross-site analytics identifiers"].map((item) => (
                  <li key={item} className="flex gap-3 text-sm text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h2 className="text-xl font-semibold tracking-[-0.03em]">Necessary network information</h2>
              <p className="mt-5 text-sm leading-6 text-muted-foreground">
                Like every website, NoTrak’s hosting provider receives technical request information needed to deliver pages. The IP tool returns the request address and available approximate Vercel location headers with a no-store response. NoTrak application code does not write these values to a database or log them intentionally.
              </p>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                The speed test contacts Cloudflare directly after you start it. Cloudflare receives your IP address and measurement traffic; NoTrak disables the library’s aggregate result-logging endpoint.
              </p>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                After a separate confirmation, URL reputation sends the full submitted URL through NoTrak to configured Google Safe Browsing and URLhaus services. Malware reputation sends only the locally calculated SHA-256 hash to MalwareBazaar—the selected file is never uploaded. Unconfigured providers are not contacted. Hosting and providers may retain operational records under their own policies.
              </p>
            </section>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
