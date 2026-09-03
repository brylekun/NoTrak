"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { generateUuids } from "@/lib/developer/uuid";
import { COPY_FALLBACK_MESSAGE, copyToClipboard } from "@/lib/clipboard";

export function UuidGenerator() {
  const [count, setCount] = useState(5);
  const [uppercase, setUppercase] = useState(false);
  const [hyphens, setHyphens] = useState(true);
  const [values, setValues] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  const generate = useCallback(() => {
    try {
      setValues(generateUuids({ count, uppercase, hyphens }));
      setMessage("");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "UUID generation failed.");
    }
  }, [count, uppercase, hyphens]);

  useEffect(() => {
    const timeout = window.setTimeout(generate, 0);
    return () => window.clearTimeout(timeout);
  }, [generate]);

  async function copy() {
    const copied = await copyToClipboard(values.join("\n"));
    if (!copied) {
      setMessage(COPY_FALLBACK_MESSAGE);
      return;
    }
    setMessage(values.length === 1 ? "UUID copied." : `${values.length} UUIDs copied.`);
    window.setTimeout(() => setMessage(""), 1800);
  }

  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-[10rem_1fr]">
        <div>
          <label htmlFor="uuid-count" className="text-sm font-semibold">Quantity</label>
          <Input
            id="uuid-count"
            className="mt-2 h-10"
            type="number"
            min={1}
            max={100}
            value={count}
            onChange={(event) => setCount(Number(event.target.value))}
          />
        </div>
        <fieldset>
          <legend className="text-sm font-semibold">Format</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/70 px-3 py-2.5 text-sm">
              <Checkbox checked={uppercase} onCheckedChange={setUppercase} /> Uppercase
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/70 px-3 py-2.5 text-sm">
              <Checkbox checked={hyphens} onCheckedChange={setHyphens} /> Hyphens
            </label>
          </div>
        </fieldset>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button className="h-10 px-4" onClick={generate}><RefreshCw aria-hidden="true" /> Generate</Button>
        <Button className="h-10 px-4" variant="outline" onClick={copy} disabled={values.length === 0}>
          {message.includes("copied") ? <Check /> : <Copy />} Copy all
        </Button>
      </div>

      <label htmlFor="uuid-results" className="mt-6 block text-sm font-semibold">Generated UUIDs</label>
      <Textarea
        id="uuid-results"
        className="mt-2 min-h-52 whitespace-pre font-mono text-sm"
        value={values.join("\n")}
        readOnly
        spellCheck={false}
      />
      <p className={`mt-3 min-h-5 text-sm ${message.includes("failed") || message.includes("between") ? "text-destructive" : "text-muted-foreground"}`} aria-live="polite">{message}</p>
    </div>
  );
}
