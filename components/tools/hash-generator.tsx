"use client";

import { useState } from "react";
import { Check, Copy, FileKey2, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatByteSize, HASH_ALGORITHMS, hashText, type HashAlgorithm } from "@/lib/crypto/hash";

const MAX_HASH_BYTES = 256 * 1024 * 1024;

export function HashGenerator() {
  const [mode, setMode] = useState<"text" | "file">("text");
  const [algorithm, setAlgorithm] = useState<HashAlgorithm>("SHA-256");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [digest, setDigest] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  function resetResult() {
    setDigest("");
    setMessage("");
  }

  async function calculate() {
    if (mode === "text" && !text) {
      setMessage("Enter text to hash.");
      return;
    }
    if (mode === "file" && !file) {
      setMessage("Choose a file to hash.");
      return;
    }
    if (file && file.size > MAX_HASH_BYTES) {
      setMessage("Choose a file no larger than 256 MB.");
      return;
    }

    setBusy(true);
    setMessage("");
    setDigest("");

    try {
      if (mode === "text") {
        setDigest(await hashText(text, algorithm));
      } else if (file) {
        const buffer = await file.arrayBuffer();
        const result = await new Promise<string>((resolve, reject) => {
          const worker = new Worker(new URL("../../lib/workers/hash.worker.ts", import.meta.url), { type: "module" });
          worker.onmessage = (event: MessageEvent<{ digest?: string; error?: string }>) => {
            worker.terminate();
            if (event.data.digest) resolve(event.data.digest);
            else reject(new Error(event.data.error ?? "Hashing failed."));
          };
          worker.onerror = () => {
            worker.terminate();
            reject(new Error("The hashing worker could not start."));
          };
          worker.postMessage({ algorithm, buffer }, [buffer]);
        });
        setDigest(result);
      }
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Hashing failed.");
    } finally {
      setBusy(false);
    }
  }

  async function copyDigest() {
    if (!digest) return;
    await navigator.clipboard.writeText(digest);
    setMessage("Hash copied.");
    window.setTimeout(() => setMessage(""), 1800);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2" aria-label="Input type">
        {(["text", "file"] as const).map((value) => (
          <Button
            key={value}
            className="h-9 px-4 capitalize"
            variant={mode === value ? "default" : "outline"}
            onClick={() => { setMode(value); resetResult(); }}
          >
            {value}
          </Button>
        ))}
      </div>

      <div className="mt-6">
        {mode === "text" ? (
          <>
            <label htmlFor="hash-text" className="text-sm font-semibold">Text to hash</label>
            <Textarea
              id="hash-text"
              className="mt-2 min-h-32 font-mono text-sm"
              value={text}
              onChange={(event) => { setText(event.target.value); resetResult(); }}
              placeholder="Type or paste text"
              spellCheck={false}
            />
          </>
        ) : (
          <>
            <label htmlFor="hash-file" className="text-sm font-semibold">File to hash</label>
            <Input
              id="hash-file"
              className="mt-2 h-11 cursor-pointer pt-2"
              type="file"
              onChange={(event) => { setFile(event.target.files?.[0] ?? null); resetResult(); }}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              {file ? `${file.name} · ${formatByteSize(file.size)}` : "Maximum file size: 256 MB"}
            </p>
          </>
        )}
      </div>

      <div className="mt-5">
        <label htmlFor="hash-algorithm" className="text-sm font-semibold">Algorithm</label>
        <select
          id="hash-algorithm"
          className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={algorithm}
          onChange={(event) => { setAlgorithm(event.target.value as HashAlgorithm); resetResult(); }}
        >
          {HASH_ALGORITHMS.map((value) => <option key={value}>{value}</option>)}
        </select>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button className="h-10 px-4" onClick={calculate} disabled={busy}>
          <FileKey2 aria-hidden="true" />
          {busy ? "Calculating…" : "Calculate hash"}
        </Button>
        {(text || file || digest) && (
          <Button className="h-10 px-4" variant="outline" onClick={() => { setText(""); setFile(null); resetResult(); }}>
            <RotateCcw aria-hidden="true" /> Reset
          </Button>
        )}
      </div>

      {digest && (
        <div className="mt-7 border-t border-border/70 pt-6" aria-live="polite">
          <label htmlFor="hash-result" className="text-sm font-semibold">{algorithm} hash</label>
          <div className="mt-2 flex gap-2">
            <Textarea id="hash-result" className="min-h-24 break-all font-mono text-sm" value={digest} readOnly spellCheck={false} />
            <Button className="h-10 shrink-0 px-3" variant="outline" onClick={copyDigest} aria-label="Copy hash">
              {message === "Hash copied." ? <Check /> : <Copy />}
            </Button>
          </div>
        </div>
      )}

      <p className={`mt-4 min-h-5 text-sm ${digest ? "text-muted-foreground" : "text-destructive"}`} role={digest ? undefined : "alert"} aria-live="polite">
        {message}
      </p>
    </div>
  );
}
