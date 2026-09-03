"use client";

import { useState } from "react";
import { Check, Copy, Eraser, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cleanTrackingUrl, type CleanUrlResult } from "@/lib/privacy/tracking-url";

export function TrackingUrlCleaner() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<CleanUrlResult | null>(null);
  const [message, setMessage] = useState("");

  function cleanUrl() {
    try {
      setResult(cleanTrackingUrl(input));
      setMessage("");
    } catch (reason) {
      setResult(null);
      setMessage(reason instanceof Error ? reason.message : "The link could not be cleaned.");
    }
  }

  async function copyResult() {
    if (!result) return;
    await navigator.clipboard.writeText(result.cleanedUrl);
    setMessage("Clean link copied.");
    window.setTimeout(() => setMessage(""), 1800);
  }

  function reset() {
    setInput("");
    setResult(null);
    setMessage("");
  }

  return (
    <div>
      <label htmlFor="tracking-url" className="text-sm font-semibold">Link to clean</label>
      <Textarea
        id="tracking-url"
        className="mt-2 min-h-28 resize-y font-mono text-sm"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        placeholder="https://example.com/article?utm_source=newsletter&topic=privacy"
        spellCheck={false}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button className="h-10 px-4" onClick={cleanUrl}>
          <Eraser aria-hidden="true" />
          Remove trackers
        </Button>
        {(input || result) && (
          <Button className="h-10 px-4" variant="outline" onClick={reset}>
            <RotateCcw aria-hidden="true" />
            Reset
          </Button>
        )}
      </div>

      {result && (
        <div className="mt-7 border-t border-border/70 pt-6" aria-live="polite">
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="cleaned-url" className="text-sm font-semibold">Clean link</label>
            <span className="mode-local">
              {result.removedParameters.length === 0
                ? "Already clean"
                : `${result.removedParameters.length} removed`}
            </span>
          </div>
          <div className="mt-2 flex gap-2">
            <Textarea id="cleaned-url" className="min-h-24 font-mono text-sm" value={result.cleanedUrl} readOnly />
            <Button className="h-10 shrink-0 px-3" variant="outline" onClick={copyResult} aria-label="Copy clean link">
              {message.startsWith("Clean link copied") ? <Check /> : <Copy />}
            </Button>
          </div>
          {result.removedParameters.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Removed parameters</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {result.removedParameters.map((parameter) => (
                  <code key={parameter} className="rounded-lg bg-muted px-2 py-1 text-xs">{parameter}</code>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <p className={`mt-4 min-h-5 text-sm ${result ? "text-muted-foreground" : "text-destructive"}`} role={result ? undefined : "alert"} aria-live="polite">
        {message}
      </p>
    </div>
  );
}
