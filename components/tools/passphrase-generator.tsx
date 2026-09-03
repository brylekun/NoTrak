"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { estimatePassphraseEntropy, generatePassphrase, type PassphraseOptions } from "@/lib/security/passphrase";
import { COPY_FALLBACK_MESSAGE, copyToClipboard } from "@/lib/clipboard";

const initialOptions: PassphraseOptions = {
  wordCount: 8,
  separator: "-",
  capitalize: false,
  includeNumber: true,
};

export function PassphraseGenerator() {
  const [options, setOptions] = useState(initialOptions);
  const [passphrase, setPassphrase] = useState("");
  const [message, setMessage] = useState("");

  const generate = useCallback(() => {
    try {
      setPassphrase(generatePassphrase(options));
      setMessage("");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Passphrase generation failed.");
    }
  }, [options]);

  useEffect(() => {
    const timeout = window.setTimeout(generate, 0);
    return () => window.clearTimeout(timeout);
  }, [generate]);

  async function copy() {
    if (!(await copyToClipboard(passphrase))) {
      setMessage(COPY_FALLBACK_MESSAGE);
      return;
    }
    setMessage("Passphrase copied.");
    window.setTimeout(() => setMessage(""), 1800);
  }

  return (
    <div>
      <label htmlFor="generated-passphrase" className="text-sm font-semibold">Generated passphrase</label>
      <div className="mt-2 flex gap-2">
        <TextareaLike value={passphrase} />
        <Button className="h-11 px-3" variant="outline" onClick={copy} aria-label="Copy passphrase">
          {message === "Passphrase copied." ? <Check /> : <Copy />}
        </Button>
        <Button className="h-11 px-3" variant="outline" onClick={generate} aria-label="Generate another passphrase">
          <RefreshCw />
        </Button>
      </div>

      <div className="mt-7">
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="passphrase-words" className="text-sm font-semibold">Words</label>
          <span className="rounded-lg bg-muted px-2.5 py-1 font-mono text-sm font-semibold">{options.wordCount}</span>
        </div>
        <Slider
          id="passphrase-words"
          className="mt-4"
          min={4}
          max={12}
          step={1}
          value={[options.wordCount]}
          onValueChange={(value) => {
            const next = Array.isArray(value) ? value[0] : value;
            if (typeof next === "number") setOptions((current) => ({ ...current, wordCount: next }));
          }}
          aria-label="Number of words"
        />
      </div>

      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="passphrase-separator" className="text-sm font-semibold">Separator</label>
          <Input
            id="passphrase-separator"
            className="mt-2 h-10 font-mono"
            value={options.separator}
            maxLength={3}
            onChange={(event) => setOptions((current) => ({ ...current, separator: event.target.value }))}
            aria-describedby="separator-help"
          />
          <p id="separator-help" className="mt-1 text-xs text-muted-foreground">Up to 3 characters; empty is allowed.</p>
        </div>
        <fieldset>
          <legend className="text-sm font-semibold">Options</legend>
          <div className="mt-2 grid gap-2">
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/70 p-3 text-sm">
              <Checkbox checked={options.capitalize} onCheckedChange={(checked) => setOptions((current) => ({ ...current, capitalize: checked }))} />
              Capitalize words
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/70 p-3 text-sm">
              <Checkbox checked={options.includeNumber} onCheckedChange={(checked) => setOptions((current) => ({ ...current, includeNumber: checked }))} />
              Add two digits
            </label>
          </div>
        </fieldset>
      </div>

      <div className="mt-6 flex items-center justify-between rounded-xl bg-primary/8 px-4 py-3 text-sm">
        <span className="text-muted-foreground">Estimated entropy</span>
        <span className="font-semibold text-primary">{estimatePassphraseEntropy(options.wordCount, options.includeNumber)} bits</span>
      </div>
      <p className="mt-3 min-h-5 text-sm text-muted-foreground" aria-live="polite">{message}</p>
    </div>
  );
}

function TextareaLike({ value }: { value: string }) {
  return (
    <textarea
      id="generated-passphrase"
      className="min-h-11 w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      value={value}
      readOnly
      spellCheck={false}
      rows={2}
    />
  );
}
