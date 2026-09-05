"use client";

import { useState } from "react";
import { Check, Copy, Eraser, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { Textarea } from "@/components/ui/textarea";
import { cleanTrackingUrl, type CleanUrlResult } from "@/lib/privacy/tracking-url";
import { COPY_FALLBACK_MESSAGE, copyToClipboard } from "@/lib/clipboard";

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
    if (!(await copyToClipboard(result.cleanedUrl))) {
      setMessage(COPY_FALLBACK_MESSAGE);
      return;
    }
    setMessage("Clean link copied.");
    window.setTimeout(() => setMessage(""), 1800);
  }

  function reset() {
    setInput("");
    setResult(null);
    setMessage("");
  }

  const removals = result
    ? [
        ...result.removedParameters.map((name) => ({ key: `q:${name}`, name, source: "query" as const })),
        ...result.removedFragmentParameters.map((name) => ({ key: `f:${name}`, name, source: "fragment" as const })),
        ...result.removedPathSegments.map((name) => ({ key: `p:${name}`, name, source: "path" as const })),
      ]
    : [];

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
        <div className="result-enter mt-7 border-t border-border/70 pt-6" aria-live="polite">
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="cleaned-url" className="text-sm font-semibold">Clean link</label>
            <span className="mode-local">
              {removals.length === 0 ? "Already clean" : `${removals.length} removed`}
            </span>
          </div>
          <div className="mt-2 flex gap-2">
            <Textarea id="cleaned-url" className="min-h-24 font-mono text-sm" value={result.cleanedUrl} readOnly />
            <Button className="h-11 min-h-[44px] min-w-[44px] shrink-0 px-3" variant="outline" onClick={copyResult} aria-label="Copy clean link">
              {message.startsWith("Clean link copied") ? <Check /> : <Copy />}
            </Button>
          </div>
          {removals.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Removed</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {removals.map(({ key, name, source }) => (
                  <li key={key} className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2 py-1 text-xs">
                    <code>{name}</code>
                    {source !== "query" && (
                      <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                        {source === "fragment" ? "in #fragment" : "path"}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <FeedbackMessage className="mt-4" tone={message.startsWith("Clean link copied") ? "success" : "error"}>{message}</FeedbackMessage>
    </div>
  );
}
