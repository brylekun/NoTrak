"use client";

import { useState } from "react";
import { Braces, Check, Copy, Minimize2, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { COPY_FALLBACK_MESSAGE, copyToClipboard } from "@/lib/clipboard";
import { JsonParseError, formatJson, type JsonFormatResult } from "@/lib/developer/json";

export function JsonFormatter() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<JsonFormatResult | null>(null);
  const [sortKeys, setSortKeys] = useState(false);
  const [message, setMessage] = useState("");

  function run(indent: number) {
    try {
      setResult(formatJson(input, { indent, sortKeys }));
      setMessage("");
    } catch (reason) {
      setResult(null);
      setMessage(
        reason instanceof JsonParseError || reason instanceof Error
          ? reason.message
          : "The JSON could not be parsed.",
      );
    }
  }

  function reset() {
    setInput("");
    setResult(null);
    setMessage("");
  }

  async function copyOutput() {
    if (!result) return;
    if (!(await copyToClipboard(result.output))) {
      setMessage(COPY_FALLBACK_MESSAGE);
      return;
    }
    setMessage("Formatted JSON copied.");
    window.setTimeout(() => setMessage(""), 1800);
  }

  return (
    <div>
      <label htmlFor="json-input" className="text-sm font-semibold">JSON</label>
      <Textarea
        id="json-input"
        className="mt-2 min-h-40 font-mono text-sm"
        value={input}
        onChange={(event) => { setInput(event.target.value); setResult(null); setMessage(""); }}
        placeholder={'{"name":"NoTrak","tools":22,"local":true}'}
        spellCheck={false}
      />

      <label className="mt-4 flex w-fit cursor-pointer items-center gap-3 rounded-xl border border-border/70 p-3 text-sm">
        <Checkbox checked={sortKeys} onCheckedChange={(checked) => { setSortKeys(checked); setResult(null); }} />
        Sort object keys alphabetically
      </label>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button className="h-10 px-4" onClick={() => run(2)}><Braces aria-hidden="true" /> Format</Button>
        <Button className="h-10 px-4" variant="outline" onClick={() => run(0)}>
          <Minimize2 aria-hidden="true" /> Minify
        </Button>
        {(input || result) && <Button className="h-10 px-4" variant="outline" onClick={reset}><RotateCcw /> Reset</Button>}
      </div>

      {result && (
        <div className="mt-7 border-t border-border/70 pt-6" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label htmlFor="json-output" className="text-sm font-semibold">Result</label>
            <p className="text-xs text-muted-foreground">
              {result.kind}
              {result.entryCount > 0 && ` · ${result.entryCount} ${result.kind === "array" ? "items" : "keys"}`}
              {` · ${result.byteSize.toLocaleString()} bytes`}
            </p>
          </div>
          <div className="mt-2 flex gap-2">
            <Textarea id="json-output" className="min-h-64 font-mono text-sm" value={result.output} readOnly />
            <Button className="h-10 shrink-0 px-3" variant="outline" onClick={copyOutput} aria-label="Copy formatted JSON">
              {message === "Formatted JSON copied." ? <Check /> : <Copy />}
            </Button>
          </div>
        </div>
      )}

      <p className="mt-4 min-h-5 text-sm text-destructive" role="alert" aria-live="polite">{message}</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        Parsed and re-printed by your browser&rsquo;s own JSON engine. Nothing is sent anywhere, so pasting a payload
        with real data does not expose it. Comments and trailing commas are not valid JSON and will be reported as
        errors.
      </p>
    </div>
  );
}
