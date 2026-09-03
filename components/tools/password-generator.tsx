"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  estimateEntropy,
  generatePassword,
  getAlphabetSize,
  type PasswordOptions,
} from "@/lib/security/password";

const initialOptions: PasswordOptions = {
  length: 20,
  lowercase: true,
  uppercase: true,
  numbers: true,
  symbols: true,
  avoidAmbiguous: true,
};

const optionLabels: Array<[keyof Pick<PasswordOptions, "lowercase" | "uppercase" | "numbers" | "symbols" | "avoidAmbiguous">, string]> = [
  ["lowercase", "Lowercase"],
  ["uppercase", "Uppercase"],
  ["numbers", "Numbers"],
  ["symbols", "Symbols"],
  ["avoidAmbiguous", "Avoid ambiguous characters"],
];

export function PasswordGenerator() {
  const [options, setOptions] = useState(initialOptions);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const createPassword = useCallback(() => {
    try {
      setPassword(generatePassword(options));
      setMessage("");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Password generation failed.");
    }
  }, [options]);

  useEffect(() => {
    const timeout = window.setTimeout(createPassword, 0);
    return () => window.clearTimeout(timeout);
  }, [createPassword]);

  const alphabetSize = useMemo(() => getAlphabetSize(options), [options]);
  const entropy = estimateEntropy(options.length, alphabetSize);

  function toggleOption(key: keyof PasswordOptions, checked: boolean) {
    const next = { ...options, [key]: checked };
    if (
      key !== "avoidAmbiguous" &&
      !next.lowercase &&
      !next.uppercase &&
      !next.numbers &&
      !next.symbols
    ) {
      setMessage("Keep at least one character type selected.");
      return;
    }
    setOptions(next);
  }

  async function copyPassword() {
    if (!password) return;
    await navigator.clipboard.writeText(password);
    setMessage("Copied to clipboard.");
    window.setTimeout(() => setMessage(""), 1800);
  }

  return (
    <div>
      <label htmlFor="generated-password" className="text-sm font-semibold">Generated password</label>
      <div className="mt-2 flex gap-2">
        <Input id="generated-password" className="h-11 font-mono text-base" value={password} readOnly spellCheck={false} />
        <Button className="h-11 px-3" variant="outline" onClick={copyPassword} aria-label="Copy password">
          {message.startsWith("Copied") ? <Check /> : <Copy />}
        </Button>
        <Button className="h-11 px-3" variant="outline" onClick={createPassword} aria-label="Generate another password">
          <RefreshCw />
        </Button>
      </div>

      <div className="mt-7">
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="password-length" className="text-sm font-semibold">Length</label>
          <span className="rounded-lg bg-muted px-2.5 py-1 font-mono text-sm font-semibold">{options.length}</span>
        </div>
        <Slider
          id="password-length"
          className="mt-4"
          min={8}
          max={64}
          step={1}
          value={[options.length]}
          onValueChange={(value) => {
            const next = Array.isArray(value) ? value[0] : value;
            if (typeof next === "number") setOptions((current) => ({ ...current, length: next }));
          }}
          aria-label="Password length"
        />
      </div>

      <fieldset className="mt-8">
        <legend className="text-sm font-semibold">Character types</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {optionLabels.map(([key, label]) => (
            <label key={key} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/70 p-3 text-sm">
              <Checkbox
                checked={options[key]}
                onCheckedChange={(checked) => toggleOption(key, checked)}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-6 flex items-center justify-between rounded-xl bg-primary/8 px-4 py-3 text-sm">
        <span className="text-muted-foreground">Estimated entropy</span>
        <span className="font-semibold text-primary">{entropy} bits</span>
      </div>
      <p className="mt-3 min-h-5 text-sm text-muted-foreground" aria-live="polite">{message}</p>
    </div>
  );
}
