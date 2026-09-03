"use client";

import { useState } from "react";
import { Check, Copy, Eye, EyeOff, LockKeyhole, RotateCcw, UnlockKeyhole } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { COPY_FALLBACK_MESSAGE, copyToClipboard } from "@/lib/clipboard";
import { MAX_PLAINTEXT_CHARACTERS, decryptText, encryptText } from "@/lib/crypto/text-encryption";

type Action = "encrypt" | "decrypt";

export function TextEncryption() {
  const [action, setAction] = useState<Action>("encrypt");
  const [input, setInput] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [output, setOutput] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  function switchAction(next: Action) {
    setAction(next);
    setInput("");
    setPassword("");
    setConfirmation("");
    setOutput("");
    setMessage("");
  }

  function reset() {
    setInput("");
    setPassword("");
    setConfirmation("");
    setOutput("");
    setMessage("");
  }

  async function run() {
    if (!input.trim()) {
      setMessage(action === "encrypt" ? "Enter a message to encrypt." : "Paste an encrypted message.");
      return;
    }
    if (action === "encrypt" && password !== confirmation) {
      setMessage("The passwords do not match.");
      return;
    }

    setBusy(true);
    setOutput("");
    setMessage("");
    try {
      setOutput(action === "encrypt" ? await encryptText(input, password) : await decryptText(input, password));
      // The password is cleared once used, so it does not linger in the form.
      setPassword("");
      setConfirmation("");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "The message could not be processed.");
    } finally {
      setBusy(false);
    }
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
      <div className="grid grid-cols-2 gap-2" aria-label="Encryption action">
        <Button className="h-10" variant={action === "encrypt" ? "default" : "outline"} onClick={() => switchAction("encrypt")}>
          <LockKeyhole aria-hidden="true" /> Encrypt
        </Button>
        <Button className="h-10" variant={action === "decrypt" ? "default" : "outline"} onClick={() => switchAction("decrypt")}>
          <UnlockKeyhole aria-hidden="true" /> Decrypt
        </Button>
      </div>

      <label htmlFor="text-encryption-input" className="mt-6 block text-sm font-semibold">
        {action === "encrypt" ? "Message" : "Encrypted message"}
      </label>
      <Textarea
        id="text-encryption-input"
        className="mt-2 min-h-32 font-mono text-sm"
        value={input}
        onChange={(event) => { setInput(event.target.value); setOutput(""); setMessage(""); }}
        placeholder={action === "encrypt" ? "Something only the recipient should read." : "NOTRAKTXT1.…"}
        spellCheck={false}
      />
      {action === "encrypt" && (
        <p className="mt-2 text-xs text-muted-foreground">
          {input.length.toLocaleString()} / {MAX_PLAINTEXT_CHARACTERS.toLocaleString()} characters
        </p>
      )}

      <div className="mt-5">
        <label htmlFor="text-encryption-password" className="text-sm font-semibold">Password or passphrase</label>
        <div className="mt-2 flex gap-2">
          <Input
            id="text-encryption-password"
            className="h-11"
            type={showPassword ? "text" : "password"}
            value={password}
            autoComplete="new-password"
            onChange={(event) => { setPassword(event.target.value); setOutput(""); setMessage(""); }}
          />
          <Button
            className="h-11 px-3"
            variant="outline"
            onClick={() => setShowPassword((current) => !current)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff /> : <Eye />}
          </Button>
        </div>
        {action === "encrypt" && (
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Use at least 12 characters. NoTrak cannot recover a forgotten password, and the recipient needs the same one.
          </p>
        )}
      </div>

      {action === "encrypt" && (
        <div className="mt-5">
          <label htmlFor="text-encryption-confirm" className="text-sm font-semibold">Confirm password</label>
          <Input
            id="text-encryption-confirm"
            className="mt-2 h-11"
            type={showPassword ? "text" : "password"}
            value={confirmation}
            autoComplete="new-password"
            onChange={(event) => { setConfirmation(event.target.value); setOutput(""); setMessage(""); }}
          />
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <Button className="h-10 px-4" onClick={run} disabled={busy}>
          {busy ? `${action === "encrypt" ? "Encrypting" : "Decrypting"}…` : action === "encrypt" ? "Encrypt message" : "Decrypt message"}
        </Button>
        {(input || output) && <Button className="h-10 px-4" variant="outline" onClick={reset}><RotateCcw /> Reset</Button>}
      </div>

      {output && (
        <div className="mt-7 border-t border-border/70 pt-6" aria-live="polite">
          <label htmlFor="text-encryption-output" className="text-sm font-semibold">
            {action === "encrypt" ? "Encrypted message — copy or share carefully" : "Decrypted message"}
          </label>
          <div className="mt-2 flex gap-2">
            <Textarea id="text-encryption-output" className="min-h-32 break-all font-mono text-sm" value={output} readOnly />
            <Button className="h-10 shrink-0 px-3" variant="outline" onClick={copyOutput} aria-label="Copy result">
              {message === "Result copied." ? <Check /> : <Copy />}
            </Button>
          </div>
        </div>
      )}

      <p className="mt-4 min-h-5 text-sm text-destructive" role="alert" aria-live="polite">{message}</p>
      <div className="mt-2 rounded-xl bg-muted/70 p-4 text-xs leading-5 text-muted-foreground">
        Format: NoTrak text v1 · AES-256-GCM · PBKDF2-HMAC-SHA-256 · 600,000 iterations. Everything happens in this
        browser: the message, the password, and the derived key are never sent anywhere. Send the password through a
        different channel than the message.
      </div>
    </div>
  );
}
