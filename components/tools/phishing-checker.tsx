"use client";

import { useState } from "react";
import { AlertTriangle, Radar, RotateCcw, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { readSecurityApiResponse, SecurityApiError } from "@/lib/security/client";
import { getProviderStatusPresentation } from "@/lib/security/provider-status";
import { analyzeUrlLocally, type UrlLocalAssessment } from "@/lib/security/url-risk";
import type { UrlProviderResult } from "@/lib/security/providers";

type LookupResult = {
  local: Omit<UrlLocalAssessment, "normalizedUrl">;
  providers: UrlProviderResult[];
  complete: boolean;
  risk: { score: number; level: "low" | "caution" | "high" };
  warning: string;
};

export function PhishingChecker() {
  const [input, setInput] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [local, setLocal] = useState<UrlLocalAssessment | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  function reset() {
    setInput(""); setConfirmed(false); setResult(null); setLocal(null); setMessage("");
  }

  async function inspect() {
    let assessment: UrlLocalAssessment;
    try {
      assessment = analyzeUrlLocally(input);
      setLocal(assessment);
      setResult(null);
      setMessage("");
    } catch (reason) {
      setLocal(null);
      setMessage(reason instanceof Error ? reason.message : "The URL could not be inspected.");
      return;
    }
    if (!confirmed) {
      setMessage("Local checks finished. Confirm the disclosure to query reputation providers.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/security/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: assessment.normalizedUrl }),
      });
      const payload = await readSecurityApiResponse<LookupResult>(response);
      setResult(payload);
      setMessage("");
    } catch (reason) {
      setMessage(reason instanceof SecurityApiError
        ? reason.message
        : "The reputation check could not be completed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const assessment = result?.local ?? local;
  const risk = result?.risk ?? (local ? { score: local.score, level: local.level } : null);

  return (
    <div>
      <div className="callout-warning">
        NoTrak never opens the submitted link. If you confirm and run the check, the full URL is sent to Google Safe Browsing and URLhaus when configured. URLhaus covers malware-distribution URLs rather than phishing generally.
      </div>
      <label htmlFor="phishing-url" className="mt-6 block text-sm font-semibold">Suspicious URL</label>
      <Textarea id="phishing-url" className="mt-2 min-h-28 font-mono text-sm" value={input} onChange={(event) => { setInput(event.target.value); setResult(null); setLocal(null); setMessage(""); }} placeholder="https://example.com/login" spellCheck={false} />

      <label className="mt-4 flex items-start gap-3 text-sm leading-6">
        <input className="mt-1 size-4 accent-primary" type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
        <span>I understand that the full URL will leave my device and be sent to the configured reputation providers.</span>
      </label>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button className="h-10 px-4" onClick={inspect} disabled={busy}><Radar />{busy ? "Checking reputation…" : confirmed ? "Run full check" : "Analyze locally"}</Button>
        {(input || assessment) && <Button className="h-10 px-4" variant="outline" onClick={reset}><RotateCcw />Reset</Button>}
      </div>

      {assessment && risk && (
        <div className="mt-7 space-y-5 border-t border-border/70 pt-6" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Explainable risk estimate</p>
              <p className="text-2xl font-semibold capitalize">{risk.level} · {risk.score}/100</p>
            </div>
            {risk.level === "high" ? <AlertTriangle className="size-8 text-destructive" /> : <ShieldCheck className="size-8 text-primary" />}
          </div>
          <div>
            <h2 className="text-sm font-semibold">Local signals</h2>
            {assessment.signals.length ? (
              <ul className="mt-2 space-y-2">{assessment.signals.map((item) => <li key={item.id} className="rounded-xl bg-muted/60 p-3 text-sm"><strong>{item.label}.</strong> <span className="text-muted-foreground">{item.detail}</span></li>)}</ul>
            ) : <p className="mt-2 text-sm text-muted-foreground">No common structural warning signals were found.</p>}
          </div>
          {result && <div><h2 className="text-sm font-semibold">Provider results</h2><dl className="mt-2 grid gap-2 sm:grid-cols-2">{result.providers.map((provider) => {
            const presentation = getProviderStatusPresentation(provider.status);
            return <div key={provider.provider} className="rounded-xl border border-border/70 p-3"><dt className="text-xs text-muted-foreground">{provider.provider}</dt><dd className={`mt-1 text-sm font-semibold ${provider.status === "match" ? "text-destructive" : presentation.incomplete ? "text-amber-700 dark:text-amber-300" : ""}`}>{presentation.label}</dd>{provider.threatTypes.length > 0 && <dd className="mt-1 text-xs text-destructive">{provider.threatTypes.join(", ")}</dd>}<dd className="mt-2 text-xs leading-5 text-muted-foreground">{presentation.detail}</dd></div>;
          })}</dl><p className={`mt-3 text-xs leading-5 ${result.complete ? "text-muted-foreground" : "text-amber-700 dark:text-amber-300"}`}>{result.warning}</p></div>}
        </div>
      )}
      <p className="mt-4 min-h-5 text-sm text-destructive" role="alert" aria-live="polite">{message}</p>
    </div>
  );
}
