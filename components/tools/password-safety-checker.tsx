"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Eye, EyeOff, RotateCcw, Search, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  analyzePasswordSafety,
  createPwnedPasswordLookup,
  findPwnedPasswordCount,
  PWNED_PASSWORDS_RANGE_URL,
} from "@/lib/security/password-safety";

type BreachResult =
  | { status: "found"; count: number }
  | { status: "not-found"; count: 0 };

const MAX_RANGE_RESPONSE_BYTES = 512 * 1024;

function formatCount(count: number): string {
  return count.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function strengthColor(score: number) {
  if (score < 40) return "bg-destructive";
  if (score < 80) return "bg-amber-500";
  return "bg-primary";
}

export function PasswordSafetyChecker() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [breachResult, setBreachResult] = useState<BreachResult | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const analysis = useMemo(() => analyzePasswordSafety(password), [password]);

  function reset() {
    setPassword("");
    setShowPassword(false);
    setConfirmed(false);
    setBreachResult(null);
    setMessage("");
    setBusy(false);
  }

  async function checkBreachCorpus() {
    if (!password) {
      setMessage("Enter a password before checking the breach corpus.");
      return;
    }
    if (!confirmed) {
      setMessage("Confirm the external lookup disclosure before checking the breach corpus.");
      return;
    }

    setBusy(true);
    setBreachResult(null);
    setMessage("");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);

    try {
      const { prefix, suffix } = await createPwnedPasswordLookup(password);
      const response = await fetch(`${PWNED_PASSWORDS_RANGE_URL}/${prefix}`, {
        cache: "no-store",
        credentials: "omit",
        headers: { "Add-Padding": "true" },
        referrerPolicy: "no-referrer",
        signal: controller.signal,
      });

      if (response.status === 429) {
        throw new Error("The breach provider is rate limiting requests. Wait briefly and try again.");
      }
      if (!response.ok) {
        throw new Error("The breach provider is temporarily unavailable. Your local analysis is still valid.");
      }

      const responseText = await response.text();
      if (responseText.length > MAX_RANGE_RESPONSE_BYTES) {
        throw new Error("The breach provider returned an unexpectedly large response.");
      }

      const count = findPwnedPasswordCount(responseText, suffix);
      setBreachResult(count > 0 ? { status: "found", count } : { status: "not-found", count: 0 });
    } catch (reason) {
      setMessage(
        reason instanceof DOMException && reason.name === "AbortError"
          ? "The breach lookup timed out. Your local analysis is still available."
          : reason instanceof Error
            ? reason.message
            : "The breach lookup could not be completed.",
      );
    } finally {
      window.clearTimeout(timeout);
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="callout-info">
        <strong>Local analysis first.</strong> NoTrak checks length and common patterns in this browser. A strength
        estimate cannot prove that a password is unique or safe.
      </div>

      <label htmlFor="password-to-check" className="mt-6 block text-sm font-semibold">Password to check</label>
      <div className="mt-2 flex gap-2">
        <Input
          id="password-to-check"
          type={showPassword ? "text" : "password"}
          className="h-11 font-mono text-base"
          value={password}
          maxLength={512}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          data-1p-ignore
          onChange={(event) => {
            setPassword(event.target.value);
            setConfirmed(false);
            setBreachResult(null);
            setMessage("");
          }}
        />
        <Button
          type="button"
          className="h-11 px-3"
          variant="outline"
          onClick={() => setShowPassword((current) => !current)}
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? <EyeOff /> : <Eye />}
        </Button>
      </div>

      {password && (
        <section className="result-enter mt-7 border-t border-border/70 pt-6" aria-live="polite">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Local strength estimate</p>
              <h2 className="mt-1 text-2xl font-semibold">{analysis.label} · {analysis.score}/100</h2>
            </div>
            <p className="text-xs text-muted-foreground">{analysis.length} characters · {analysis.characterTypes} character types</p>
          </div>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Estimated password strength"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={analysis.score}
          >
            <div className={`h-full rounded-full transition-[width] ${strengthColor(analysis.score)}`} style={{ width: `${analysis.score}%` }} />
          </div>

          {analysis.warnings.length > 0 && (
            <div className="mt-5">
              <h3 className="text-sm font-semibold">Warnings</h3>
              <ul className="mt-2 space-y-2">
                {analysis.warnings.map((warning) => (
                  <li key={warning} className="flex gap-2 rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-300" aria-hidden="true" />
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {analysis.suggestions.length > 0 && (
            <div className="mt-5">
              <h3 className="text-sm font-semibold">Improve it</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-muted-foreground">
                {analysis.suggestions.map((suggestion) => <li key={suggestion}>{suggestion}</li>)}
              </ul>
            </div>
          )}
        </section>
      )}

      <div className="mt-7 callout-warning">
        <strong>Optional external breach check.</strong> After confirmation, this browser calculates a SHA-1 lookup
        identifier and sends only its first five hexadecimal characters directly to Have I Been Pwned. HIBP receives
        your IP address and that prefix, but not the password or full hash. SHA-1 is used only because the provider&rsquo;s
        matching protocol requires it—not to protect or store the password.
      </div>

      <label className="mt-4 flex items-start gap-3 text-sm leading-6">
        <input
          className="mt-1 size-4 accent-primary"
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
        <span>I understand that a five-character hash prefix and my request IP will be visible to Have I Been Pwned.</span>
      </label>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button type="button" className="h-10 px-4" onClick={checkBreachCorpus} disabled={busy || !password}>
          <Search />{busy ? "Checking breach corpus…" : "Check breach corpus"}
        </Button>
        {password && <Button type="button" className="h-10 px-4" variant="outline" onClick={reset} disabled={busy}><RotateCcw />Reset</Button>}
      </div>

      {breachResult && (
        <section className={`result-enter mt-7 rounded-2xl border p-5 ${breachResult.status === "found" ? "border-destructive/30 bg-destructive/5" : "border-primary/20 bg-primary/6"}`} aria-live="polite">
          <div className="flex items-start gap-3">
            {breachResult.status === "found"
              ? <AlertTriangle className="mt-0.5 size-6 shrink-0 text-destructive" aria-hidden="true" />
              : <ShieldCheck className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden="true" />}
            <div>
              <h2 className="text-lg font-semibold">
                {breachResult.status === "found" ? "Found in the breach corpus" : "Not found in the breach corpus"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {breachResult.status === "found"
                  ? `This password appears ${formatCount(breachResult.count)} times in the provider’s corpus. Do not use it; replace it anywhere it is active.`
                  : "No matching hash was returned. This does not prove the password is safe, unique, or absent from every breach."}
              </p>
            </div>
          </div>
        </section>
      )}

      <p className="mt-4 min-h-5 text-sm text-destructive" role="alert" aria-live="polite">{message}</p>
    </div>
  );
}
