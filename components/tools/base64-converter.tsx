"use client";

import { useState } from "react";
import { ArrowLeftRight, Check, Copy, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { Textarea } from "@/components/ui/textarea";
import { COPY_FALLBACK_MESSAGE, copyToClipboard } from "@/lib/clipboard";
import { decodeBase64, encodeBase64 } from "@/lib/developer/base64";

type Mode = "encode" | "decode";

export function Base64Converter() {
  const [mode, setMode] = useState<Mode>("encode");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [urlSafe, setUrlSafe] = useState(false);
  const [stripPadding, setStripPadding] = useState(false);
  const [message, setMessage] = useState("");

  function convert() {
    try {
      setOutput(
        mode === "encode"
          ? encodeBase64(input, urlSafe ? "urlsafe" : "standard", stripPadding)
          : decodeBase64(input),
      );
      setMessage("");
    } catch (reason) {
      setOutput("");
      setMessage(reason instanceof Error ? reason.message : "The value could not be converted.");
    }
  }

  function swap() {
    setMode((current) => (current === "encode" ? "decode" : "encode"));
    setInput(output || input);
    setOutput("");
    setMessage("");
  }

  function reset() {
    setInput("");
    setOutput("");
    setMessage("");
  }

  async function copyOutput() {
    if (!output) return;
    if (!(await copyToClipboard(output))) {
      setMessage(COPY_FALLBACK_MESSAGE);
      return;
    }
    setMessage("Result copied.");
    window.setTimeout(() => setMessage(""), 1800);
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-2" aria-label="Conversion direction">
        <Button className="h-10" variant={mode === "encode" ? "default" : "outline"} onClick={() => { setMode("encode"); setOutput(""); setMessage(""); }}>
          Text to Base64
        </Button>
        <Button className="h-10" variant={mode === "decode" ? "default" : "outline"} onClick={() => { setMode("decode"); setOutput(""); setMessage(""); }}>
          Base64 to text
        </Button>
      </div>

      <label htmlFor="base64-input" className="mt-6 block text-sm font-semibold">
        {mode === "encode" ? "Text" : "Base64"}
      </label>
      <Textarea
        id="base64-input"
        className="mt-2 min-h-32 font-mono text-sm"
        value={input}
        onChange={(event) => { setInput(event.target.value); setOutput(""); setMessage(""); }}
        placeholder={mode === "encode" ? "Anything you like — emoji and accents included." : "SGVsbG8sIE5vVHJhayE="}
        spellCheck={false}
      />

      {mode === "encode" && (
        <fieldset className="mt-4">
          <legend className="text-sm font-semibold">Output style</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/70 p-3 text-sm">
              <Checkbox checked={urlSafe} onCheckedChange={(checked) => { setUrlSafe(checked); setOutput(""); }} />
              URL-safe alphabet
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/70 p-3 text-sm">
              <Checkbox
                checked={stripPadding}
                disabled={!urlSafe}
                onCheckedChange={(checked) => { setStripPadding(checked); setOutput(""); }}
              />
              Strip trailing padding
            </label>
          </div>
        </fieldset>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <Button className="h-10 px-4" onClick={convert}>{mode === "encode" ? "Encode" : "Decode"}</Button>
        <Button className="h-10 px-4" variant="outline" onClick={swap}>
          <ArrowLeftRight aria-hidden="true" /> Swap
        </Button>
        {(input || output) && <Button className="h-10 px-4" variant="outline" onClick={reset}><RotateCcw /> Reset</Button>}
      </div>

      {output && (
        <div className="result-enter mt-7 border-t border-border/70 pt-6" aria-live="polite">
          <label htmlFor="base64-output" className="text-sm font-semibold">Result</label>
          <div className="mt-2 flex gap-2">
            <Textarea id="base64-output" className="min-h-32 font-mono text-sm" value={output} readOnly />
            <Button className="h-11 min-h-[44px] min-w-[44px] shrink-0 px-3" variant="outline" onClick={copyOutput} aria-label="Copy result">
              {message === "Result copied." ? <Check /> : <Copy />}
            </Button>
          </div>
        </div>
      )}

      <FeedbackMessage className="mt-4" tone={message === "Result copied." ? "success" : "error"}>{message}</FeedbackMessage>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        Base64 is an encoding, not encryption: anyone can decode it. Use File or Text Encryption to actually protect
        something. Text is encoded through UTF-8, so non-English characters round-trip correctly.
      </p>
    </div>
  );
}
