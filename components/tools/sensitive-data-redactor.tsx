"use client";

import { useMemo, useRef, useState } from "react";
import { Check, Copy, Download, Eraser, FileText, RotateCcw, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { COPY_FALLBACK_MESSAGE, copyToClipboard } from "@/lib/clipboard";
import {
  MAX_REDACTOR_CHARACTERS,
  redactSensitiveData,
  redactedTextName,
  scanSensitiveData,
  validateSensitiveTextFile,
  type SensitiveFinding,
  type SensitiveScan,
} from "@/lib/privacy/sensitive-data";

export function SensitiveDataRedactor() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState("");
  const [sourceName, setSourceName] = useState<string>();
  const [scan, setScan] = useState<SensitiveScan | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedFindings = scan?.findings.filter((finding) => selectedIds.has(finding.id)) ?? [];
  const selectedOccurrences = selectedFindings.reduce((sum, finding) => sum + finding.occurrences.length, 0);
  const output = useMemo(
    () => scan ? redactSensitiveData(input, scan.findings, selectedIds) : "",
    [input, scan, selectedIds],
  );

  function clearResult() {
    setScan(null);
    setSelectedIds(new Set());
    setError("");
    setStatus("");
  }

  async function loadFile(file: File | null) {
    clearResult();
    setSourceName(undefined);
    if (!file) return;

    setBusy(true);
    try {
      validateSensitiveTextFile(file);
      const text = await file.text();
      if (text.includes("\0")) throw new Error("This file appears to contain binary data rather than plain text.");
      if (text.length > MAX_REDACTOR_CHARACTERS) {
        throw new Error(`Decoded text must not exceed ${MAX_REDACTOR_CHARACTERS.toLocaleString()} characters.`);
      }
      setInput(text);
      setSourceName(file.name);
      setStatus(`${file.name} loaded locally.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The selected file could not be read.");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setBusy(false);
    }
  }

  function analyze() {
    try {
      const result = scanSensitiveData(input);
      setScan(result);
      setSelectedIds(new Set(result.findings.map((finding) => finding.id)));
      setError("");
      setStatus(result.findings.length === 0
        ? "No supported sensitive-data patterns were found. This is not proof the text is safe to share."
        : `${result.occurrenceCount} sensitive-data occurrence${result.occurrenceCount === 1 ? "" : "s"} found locally.`);
    } catch (reason) {
      setScan(null);
      setSelectedIds(new Set());
      setError(reason instanceof Error ? reason.message : "The text could not be analyzed.");
      setStatus("");
    }
  }

  function toggleFinding(finding: SensitiveFinding, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(finding.id);
      else next.delete(finding.id);
      return next;
    });
    setStatus("");
  }

  async function copyOutput() {
    if (!output || selectedIds.size === 0) return;
    if (!(await copyToClipboard(output))) {
      setError(COPY_FALLBACK_MESSAGE);
      return;
    }
    setError("");
    setStatus("Sanitized text copied.");
    window.setTimeout(() => setStatus(""), 1800);
  }

  function downloadOutput() {
    if (!output || selectedIds.size === 0) return;
    const blob = new Blob([output], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = redactedTextName(sourceName);
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setStatus("Sanitized copy downloaded.");
  }

  function reset() {
    setInput("");
    setSourceName(undefined);
    setBusy(false);
    clearResult();
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const categorySummary = scan?.findings.reduce<Record<string, number>>((summary, finding) => {
    summary[finding.label] = (summary[finding.label] ?? 0) + finding.occurrences.length;
    return summary;
  }, {}) ?? {};

  return (
    <div>
      <div className="callout-info">
        <strong>Processed entirely in your browser.</strong> Text and selected files are never uploaded, logged, or saved
        by NoTrak. Only the sanitized copy is created.
      </div>

      <label htmlFor="redactor-file" className="mt-6 block text-sm font-semibold">Load a text-based file (optional)</label>
      <Input
        ref={fileInputRef}
        id="redactor-file"
        className="mt-2 h-11 cursor-pointer pt-2"
        type="file"
        accept=".txt,.text,.log,.csv,.json,.md,text/plain,text/csv,text/markdown,application/json"
        disabled={busy}
        onChange={(event) => void loadFile(event.target.files?.[0] ?? null)}
      />
      <p className="mt-2 text-xs leading-5 text-muted-foreground">TXT, LOG, CSV, JSON, or Markdown up to 5 MB.</p>

      <label htmlFor="redactor-input" className="mt-6 block text-sm font-semibold">Text to inspect</label>
      <Textarea
        id="redactor-input"
        className="mt-2 min-h-56 font-mono text-xs leading-5"
        value={input}
        maxLength={MAX_REDACTOR_CHARACTERS}
        onChange={(event) => { setInput(event.target.value); setSourceName(undefined); clearResult(); }}
        placeholder={"Customer: person@example.com\nServer: 203.0.113.10\nAuthorization: Bearer replace-this-token\nCallback: https://example.com/callback?access_token=replace-me"}
        spellCheck={false}
      />
      <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
        <span>Detects high-confidence emails, formatted phone numbers, IPs, valid card numbers, tokens, private keys, JWTs, and URL secrets.</span>
        <span>{input.length.toLocaleString()} / {MAX_REDACTOR_CHARACTERS.toLocaleString()}</span>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button className="h-10 px-4" onClick={analyze} disabled={busy || !input.trim()}>
          <Eraser aria-hidden="true" /> Analyze locally
        </Button>
        {(input || scan) && <Button className="h-10 px-4" variant="outline" onClick={reset}><RotateCcw /> Reset</Button>}
      </div>

      {scan && scan.findings.length > 0 && (
        <div className="result-enter mt-7 space-y-6 border-t border-border/70 pt-6" aria-live="polite">
          <section className="rounded-2xl border border-primary/20 bg-primary/6 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary"><ShieldCheck /></span>
                <div>
                  <p className="font-semibold">Review {scan.findings.length} unique finding{scan.findings.length === 1 ? "" : "s"}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {scan.occurrenceCount} occurrence{scan.occurrenceCount === 1 ? "" : "s"} found. Repeated values use the same placeholder.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set(scan.findings.map((finding) => finding.id)))}>Select all</Button>
                <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())}>Clear</Button>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {Object.entries(categorySummary).map(([label, count]) => (
                <span key={label} className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-xs">
                  {label} · {count}
                </span>
              ))}
            </div>
            {scan.truncated && (
              <p className="mt-4 text-sm text-amber-700 dark:text-amber-300">
                The review list reached its 500-item limit. Split this text into smaller sections before sharing it.
              </p>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold">Choose what to redact</h2>
            <ul className="mt-3 grid gap-2">
              {scan.findings.map((finding) => (
                <li key={finding.id}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/70 p-3 hover:bg-muted/40">
                    <Checkbox
                      className="mt-0.5"
                      checked={selectedIds.has(finding.id)}
                      onCheckedChange={(checked) => toggleFinding(finding, checked === true)}
                      aria-label={`Redact ${finding.label}: ${finding.preview}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-semibold">{finding.label}</span>
                        <span className="font-mono text-xs text-primary">{finding.placeholder}</span>
                      </span>
                      <span className="mt-1 block break-all font-mono text-xs text-muted-foreground">{finding.preview}</span>
                      {finding.occurrences.length > 1 && (
                        <span className="mt-1 block text-xs text-muted-foreground">Appears {finding.occurrences.length} times</span>
                      )}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <label htmlFor="redactor-output" className="text-sm font-semibold">Sanitized result</label>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedOccurrences} occurrence{selectedOccurrences === 1 ? "" : "s"} selected for redaction.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button className="h-9 px-3" variant="outline" onClick={copyOutput} disabled={selectedIds.size === 0}>
                  {status === "Sanitized text copied." ? <Check /> : <Copy />} Copy result
                </Button>
                <Button className="h-9 px-3" variant="outline" onClick={downloadOutput} disabled={selectedIds.size === 0}>
                  <Download /> Download sanitized copy
                </Button>
              </div>
            </div>
            <Textarea id="redactor-output" className="mt-3 min-h-56 font-mono text-xs leading-5" value={output} readOnly />
          </section>
        </div>
      )}

      {scan && scan.findings.length === 0 && (
        <section className="result-enter mt-7 rounded-2xl border border-border/80 bg-muted/30 p-5" aria-live="polite">
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div>
              <h2 className="font-semibold">No supported patterns found</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                This scan is intentionally conservative and cannot recognize every kind of personal information or secret.
                Read the text yourself before sharing it.
              </p>
            </div>
          </div>
        </section>
      )}

      <p className="mt-4 min-h-5 text-sm text-destructive" role="alert" aria-live="assertive">{error}</p>
      <p className="min-h-5 text-sm text-muted-foreground" role="status" aria-live="polite">{status}</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        Automated redaction can miss names, addresses, unusual identifiers, custom secret formats, and context-dependent
        private information. A clean scan is not proof that text is safe to publish.
      </p>
    </div>
  );
}
