"use client";

import { useState } from "react";
import { Globe2, RotateCcw, Search, ShieldCheck, ShieldQuestion } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import {
  DNS_RECORD_TYPES,
  dnsLookupUrl,
  formatDnsTtl,
  inspectDomainInput,
  parseDnsResponse,
  type DnsLookupResult,
  type DnsRecordType,
  type DomainInspection,
} from "@/lib/network/dns";

const TYPE_OPTIONS = DNS_RECORD_TYPES.map((type) => ({ value: type, label: type }));

export function DnsDomainInspector() {
  const [input, setInput] = useState("");
  const [recordType, setRecordType] = useState<DnsRecordType>("A");
  const [confirmed, setConfirmed] = useState(false);
  const [inspection, setInspection] = useState<DomainInspection | null>(null);
  const [result, setResult] = useState<DnsLookupResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"neutral" | "success" | "error">("neutral");

  function reset() {
    setInput("");
    setRecordType("A");
    setConfirmed(false);
    setInspection(null);
    setResult(null);
    setMessage("");
  }

  async function inspect() {
    let domain: DomainInspection;
    try {
      domain = inspectDomainInput(input);
      setInspection(domain);
      setResult(null);
      setTone("neutral");
      setMessage(confirmed ? "" : "Local inspection finished. Confirm the disclosure to request live DNS records.");
    } catch (reason) {
      setInspection(null);
      setResult(null);
      setTone("error");
      setMessage(reason instanceof Error ? reason.message : "The domain could not be inspected.");
      return;
    }
    if (!confirmed) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    setBusy(true);
    try {
      const response = await fetch(dnsLookupUrl(domain.domain, recordType), {
        method: "GET",
        headers: { Accept: "application/dns-json" },
        credentials: "omit",
        cache: "no-store",
        referrerPolicy: "no-referrer",
        signal: controller.signal,
      });
      if (!response.ok) {
        if (response.status === 429) throw new Error("Cloudflare is rate limiting DNS lookups. Wait and try again.");
        throw new Error("The DNS resolver could not complete this lookup.");
      }
      const parsed = parseDnsResponse(await response.json());
      setResult(parsed);
      setTone(parsed.status === 0 ? "success" : "neutral");
      setMessage(parsed.status === 0 ? "Live DNS lookup complete." : `The resolver returned: ${parsed.statusLabel}.`);
    } catch (reason) {
      const timedOut = controller.signal.aborted;
      setTone("error");
      setMessage(timedOut ? "The DNS lookup timed out. Check your connection and try again." : reason instanceof Error ? reason.message : "The DNS lookup failed.");
    } finally {
      window.clearTimeout(timeout);
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="callout-warning text-sm leading-6">
        Local inspection does not contact the domain. After confirmation, only the normalized domain and selected
        record type are sent directly to Cloudflare&rsquo;s DNS-over-HTTPS resolver. Cloudflare also receives your IP address.
      </div>

      <label htmlFor="dns-domain" className="mt-6 block text-sm font-semibold">Domain or website URL</label>
      <Input id="dns-domain" className="mt-2 font-mono" value={input} placeholder="example.com" spellCheck={false} autoCapitalize="none" onChange={(event) => { setInput(event.target.value); setInspection(null); setResult(null); setMessage(""); }} />

      <div className="mt-5 max-w-xs">
        <SelectField label="DNS record type" value={recordType} options={TYPE_OPTIONS} disabled={busy} onValueChange={(value) => { setRecordType(value); setResult(null); setMessage(""); }} description="A and AAAA are addresses; MX handles mail; NS identifies name servers; TXT often carries verification and email policies." />
      </div>

      <label className="mt-5 flex items-start gap-3 text-sm leading-6">
        <input className="mt-1 size-4 shrink-0 accent-primary" type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
        <span>I understand that the domain and record type will leave my device and be sent directly to Cloudflare DNS.</span>
      </label>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button type="button" className="h-10 px-4" disabled={busy || !input.trim()} onClick={() => void inspect()}>
          {confirmed ? <Search aria-hidden="true" /> : <Globe2 aria-hidden="true" />}
          {busy ? "Looking up DNS…" : confirmed ? `Look up ${recordType} records` : "Inspect locally"}
        </Button>
        {(input || inspection) && <Button type="button" className="h-10 px-4" variant="outline" disabled={busy} onClick={reset}><RotateCcw aria-hidden="true" /> Reset</Button>}
      </div>

      {inspection && (
        <section className="result-enter mt-7 border-t border-border/70 pt-6" aria-live="polite">
          <h2 className="text-lg font-semibold">Domain details</h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border/70 bg-muted/25 p-3"><dt className="text-xs text-muted-foreground">Normalized query</dt><dd className="mt-1 break-all font-mono text-sm font-medium">{inspection.domain}</dd></div>
            <div className="rounded-xl border border-border/70 bg-muted/25 p-3"><dt className="text-xs text-muted-foreground">Labels</dt><dd className="mt-1 text-sm font-medium">{inspection.labels.length}</dd></div>
            <div className="rounded-xl border border-border/70 bg-muted/25 p-3"><dt className="text-xs text-muted-foreground">Submitted as</dt><dd className="mt-1 text-sm font-medium">{inspection.sourceWasUrl ? "Website URL (path removed locally)" : "Domain name"}</dd></div>
            <div className="rounded-xl border border-border/70 bg-muted/25 p-3"><dt className="text-xs text-muted-foreground">Internationalized form</dt><dd className="mt-1 text-sm font-medium">{inspection.usesPunycode ? "Punycode present — verify spelling" : "No Punycode labels"}</dd></div>
          </dl>
        </section>
      )}

      {result && inspection && (
        <section className="result-enter mt-7 border-t border-border/70 pt-6" aria-live="polite">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-sm text-muted-foreground">Cloudflare DNS response</p><h2 className="mt-1 text-2xl font-semibold">{result.statusLabel}</h2></div>
            <div className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium ${result.authenticatedData ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
              {result.authenticatedData ? <ShieldCheck className="size-4" aria-hidden="true" /> : <ShieldQuestion className="size-4" aria-hidden="true" />}
              {result.authenticatedData ? "DNSSEC validated" : "DNSSEC not validated"}
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">A response without DNSSEC validation is not automatically malicious; the domain may simply be unsigned. DNS results can change when their TTL expires.</p>

          {result.answers.length > 0 ? (
            <div className="mt-5 overflow-x-auto rounded-xl border border-border/80">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead className="bg-muted/60 text-xs text-muted-foreground"><tr><th className="px-3 py-2 font-medium">Type</th><th className="px-3 py-2 font-medium">Name</th><th className="px-3 py-2 font-medium">Value</th><th className="px-3 py-2 font-medium">TTL</th></tr></thead>
                <tbody className="divide-y divide-border/70">{result.answers.map((answer, index) => <tr key={`${answer.name}-${answer.type}-${answer.data}-${index}`}><td className="px-3 py-3 font-semibold">{answer.type}</td><td className="max-w-44 break-all px-3 py-3 font-mono text-xs">{answer.name}</td><td className="break-all px-3 py-3 font-mono text-xs">{answer.data}</td><td className="whitespace-nowrap px-3 py-3 text-xs text-muted-foreground" title={`${answer.ttl} seconds`}>{formatDnsTtl(answer.ttl)}</td></tr>)}</tbody>
              </table>
            </div>
          ) : <div className="mt-5 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">No {recordType} answer records were returned. That does not prove the domain or service is unavailable.</div>}
          {result.truncated && <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">The resolver marked this response as truncated, so records may be incomplete.</p>}
        </section>
      )}

      <FeedbackMessage className="mt-4" tone={tone}>{message}</FeedbackMessage>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">This tool reports public recursive-DNS answers. It does not contact the website, prove ownership, enumerate every subdomain, or replace authoritative DNS and registrar tools.</p>
    </div>
  );
}
