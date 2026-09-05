"use client";

import { useState } from "react";
import { AlertTriangle, MailSearch, RotateCcw, ShieldQuestion } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  analyzeEmailHeaders,
  formatHopDelay,
  type EmailAuthResult,
  type EmailHeaderReport,
  type EmailRiskLevel,
} from "@/lib/security/email-headers";

const LEVEL_COPY: Record<EmailRiskLevel, { title: string; body: string }> = {
  low: {
    title: "No notable signals",
    body: "Nothing in this header block stood out. That is not proof the message is legitimate: a convincing message sent from a genuinely compromised account produces a clean header report.",
  },
  caution: {
    title: "Worth a closer look",
    body: "Some signals deserve attention. Read each one below and judge it against what you expected from this sender.",
  },
  high: {
    title: "Strong warning signals",
    body: "Several signals point at a forged or misdirected sender. Do not act on this message, follow its links, or open attachments until you have confirmed it another way.",
  },
};

const VERDICT_CLASS: Record<string, string> = {
  pass: "surface-withheld",
  fail: "bg-destructive/10 text-destructive",
  softfail: "surface-exposed",
  policy: "surface-exposed",
  permerror: "surface-exposed",
  temperror: "surface-exposed",
};

function levelClass(level: EmailRiskLevel) {
  if (level === "high") return "border-destructive/30 bg-destructive/5";
  if (level === "caution") return "border-amber-300/60 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/35";
  return "border-primary/20 bg-primary/6";
}

function scoreBarClass(level: EmailRiskLevel) {
  if (level === "high") return "bg-destructive";
  if (level === "caution") return "bg-amber-500";
  return "bg-primary";
}

export function EmailHeaderAnalyzer() {
  const [raw, setRaw] = useState("");
  const [report, setReport] = useState<EmailHeaderReport | null>(null);
  const [message, setMessage] = useState("");
  const [showFields, setShowFields] = useState(false);

  function analyze() {
    try {
      setReport(analyzeEmailHeaders(raw));
      setMessage("");
    } catch (reason) {
      setReport(null);
      setMessage(reason instanceof Error ? reason.message : "The header block could not be analyzed.");
    }
  }

  function reset() {
    setRaw("");
    setReport(null);
    setMessage("");
    setShowFields(false);
  }

  return (
    <div>
      <div className="callout-info">
        <strong>Read entirely in your browser.</strong> Headers carry recipient names, internal server names, and the
        sending IP address. Nothing you paste here is uploaded, logged, or kept after you leave the page.
      </div>

      <label htmlFor="email-headers" className="mt-6 block text-sm font-semibold">Raw email headers</label>
      <Textarea
        id="email-headers"
        className="mt-2 min-h-52 font-mono text-xs leading-5"
        value={raw}
        onChange={(event) => { setRaw(event.target.value); setReport(null); setMessage(""); }}
        placeholder={"Received: from mail.example.com (mail.example.com [203.0.113.10])\n\tby mx.recipient.test with ESMTPS id abc123;\n\tTue, 1 Sep 2026 09:14:02 +0000\nAuthentication-Results: mx.recipient.test; spf=pass; dkim=pass; dmarc=pass\nFrom: Support <support@example.com>\nSubject: Your receipt"}
        spellCheck={false}
      />
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        In Gmail open the message menu and choose <em>Show original</em>. In Outlook use <em>File → Properties</em> and copy
        the internet headers. In Apple Mail use <em>View → Message → All Headers</em>.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button className="h-10 px-4" onClick={analyze} disabled={!raw.trim()}>
          <MailSearch aria-hidden="true" /> Analyze locally
        </Button>
        {(raw || report) && <Button className="h-10 px-4" variant="outline" onClick={reset}><RotateCcw /> Reset</Button>}
      </div>

      {report && (
        <div className="result-enter mt-7 space-y-6 border-t border-border/70 pt-6" aria-live="polite">
          <section className={`rounded-2xl border p-5 ${levelClass(report.level)}`}>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Local header assessment</p>
                <h2 className="mt-1 text-2xl font-semibold">{LEVEL_COPY[report.level].title}</h2>
              </div>
              <p className="text-xs text-muted-foreground">
                {report.signals.length} {report.signals.length === 1 ? "signal" : "signals"} · {report.fieldCount} header fields
              </p>
            </div>
            <div
              className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label="Combined weight of local header signals"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={report.score}
            >
              <div className={`h-full rounded-full ${scoreBarClass(report.level)}`} style={{ width: `${Math.max(report.score, 2)}%` }} />
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{LEVEL_COPY[report.level].body}</p>
          </section>

          <Summary report={report} />

          {report.auth.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold">Authentication results</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                These verdicts were written by the receiving mail server. NoTrak reports them as found; it does not verify
                a signature or query DNS, so they are only as trustworthy as the block you pasted.
              </p>
              <ul className="mt-3 space-y-2">
                {report.auth.map((result, index) => <AuthRow key={`${result.method}-${index}`} result={result} />)}
              </ul>
              {report.arcPresent && (
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  ARC headers are present, which usually means the message was forwarded and an intermediate server
                  vouched for the original authentication.
                </p>
              )}
            </section>
          )}

          {report.signals.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold">Signals found</h2>
              <ul className="mt-3 space-y-2">
                {report.signals.map((item) => (
                  <li key={item.id} className="flex gap-3 rounded-xl bg-muted/60 p-3 text-sm">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-300" aria-hidden="true" />
                    <div>
                      <p className="font-semibold">{item.label}</p>
                      <p className="mt-1 leading-6 text-muted-foreground">{item.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {report.hops.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold">Delivery chain</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Ordered from the earliest hop NoTrak can see toward you. Only hops after the sending server are reliable;
                anything a sender writes themselves can be fabricated.
              </p>
              <ol className="mt-3 space-y-2">
                {report.hops.map((hop) => (
                  <li key={hop.position} className="rounded-xl border border-border/70 p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">Hop {hop.position}</span>
                      {hop.ip && (
                        <span className={`font-mono text-xs ${hop.ipIsPrivate ? "text-muted-foreground" : ""}`}>
                          {hop.ip}{hop.ipIsPrivate ? " (private)" : ""}
                        </span>
                      )}
                      {hop.withProtocol && <span className="text-xs text-muted-foreground">via {hop.withProtocol}</span>}
                      {hop.delaySeconds !== undefined && (
                        <span className="text-xs text-muted-foreground">+{formatHopDelay(hop.delaySeconds)}</span>
                      )}
                    </div>
                    <dl className="mt-2 grid gap-1 text-xs leading-5 text-muted-foreground sm:grid-cols-[4rem_1fr]">
                      {hop.from && <><dt className="font-semibold text-foreground">From</dt><dd className="break-words font-mono">{hop.from}</dd></>}
                      {hop.by && <><dt className="font-semibold text-foreground">By</dt><dd className="break-words font-mono">{hop.by}</dd></>}
                      {hop.timestamp && <><dt className="font-semibold text-foreground">Dated</dt><dd className="break-words">{hop.timestamp}</dd></>}
                    </dl>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">All header fields</h2>
              <Button
                className="h-9 px-3"
                variant="outline"
                onClick={() => setShowFields((current) => !current)}
                aria-expanded={showFields}
              >
                {showFields ? "Hide" : `Show ${report.fieldCount}`}
              </Button>
            </div>
            {showFields && (
              <dl className="mt-3 divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/70">
                {report.fields.map((field, index) => (
                  <div key={`${field.name}-${index}`} className="grid gap-1 px-4 py-3 sm:grid-cols-[13rem_1fr] sm:gap-4">
                    <dt className="break-words text-sm font-semibold">{field.name}</dt>
                    <dd className="break-words font-mono text-xs leading-5 text-muted-foreground">{field.value || "(empty)"}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          <div className="callout-warning flex items-start gap-3">
            <ShieldQuestion className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-semibold">A clean report is not a verdict.</p>
              <p className="mt-1">
                Headers show how a message was delivered, not whether its contents are honest. When money, credentials, or
                urgency are involved, confirm through a channel you already trust rather than by replying.
              </p>
            </div>
          </div>
        </div>
      )}

      <p className="mt-4 min-h-5 text-sm text-destructive" role="alert" aria-live="polite">{message}</p>
    </div>
  );
}

function AuthRow({ result }: { result: EmailAuthResult }) {
  return (
    <li className="rounded-xl border border-border/70 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold uppercase">{result.method}</span>
        <span className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${VERDICT_CLASS[result.verdict] ?? "bg-muted text-muted-foreground"}`}>
          {result.verdict}
        </span>
      </div>
      {result.detail && <p className="mt-2 break-words font-mono text-xs leading-5 text-muted-foreground">{result.detail}</p>}
      {result.reportedBy && <p className="mt-1 text-xs text-muted-foreground">Reported by {result.reportedBy}</p>}
    </li>
  );
}

function Summary({ report }: { report: EmailHeaderReport }) {
  const rows: Array<{ label: string; value: string; mono?: boolean }> = [];

  for (const field of report.addresses) {
    if (!field.address && !field.displayName) continue;
    rows.push({
      label: field.header,
      value: field.displayName && field.address
        ? `${field.displayName} <${field.address}>`
        : field.address ?? field.displayName ?? "",
      mono: true,
    });
  }
  if (report.subject) rows.push({ label: "Subject", value: report.subject });
  if (report.date) rows.push({ label: "Date", value: report.date });
  if (report.originatingIp) {
    rows.push({
      label: "Earliest source",
      value: `${report.originatingIp}${report.originatingIpIsPrivate ? " (private or loopback)" : ""}`,
      mono: true,
    });
  }
  if (report.hops.length > 0) {
    rows.push({ label: "Hops", value: `${report.hops.length} ${report.hops.length === 1 ? "server" : "servers"}` });
  }
  if (report.transitSeconds !== undefined) {
    rows.push({ label: "Time in transit", value: formatHopDelay(report.transitSeconds) });
  }
  if (report.messageId) rows.push({ label: "Message-ID", value: report.messageId, mono: true });

  if (rows.length === 0) return null;

  return (
    <section>
      <h2 className="text-sm font-semibold">Message summary</h2>
      <dl className="mt-3 divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/70">
        {rows.map((row) => (
          <div key={row.label} className="grid gap-1 px-4 py-3 sm:grid-cols-[11rem_1fr] sm:gap-4">
            <dt className="text-sm font-semibold">{row.label}</dt>
            <dd className={`break-words text-sm text-muted-foreground ${row.mono ? "font-mono text-xs leading-5" : ""}`}>{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
