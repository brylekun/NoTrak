"use client";

import { useEffect, useState } from "react";
import { Download, Eye, EyeOff, FileKey2, LockKeyhole, RotateCcw, UnlockKeyhole } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAX_PLAINTEXT_BYTES, encryptedFilename } from "@/lib/crypto/file-encryption";
import { formatByteSize } from "@/lib/crypto/hash";

type Result = { url: string; name: string; size: number; action: "encrypt" | "decrypt" };

export function FileEncryption() {
  const [action, setAction] = useState<"encrypt" | "decrypt">("encrypt");
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const url = result?.url;
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [result?.url]);

  function clearResult() {
    setResult(null);
    setMessage("");
  }

  function switchAction(next: "encrypt" | "decrypt") {
    setAction(next);
    setFile(null);
    setPassword("");
    setConfirmation("");
    clearResult();
  }

  async function processFile() {
    if (!file) {
      setMessage(`Choose a file to ${action}.`);
      return;
    }
    if (file.size === 0) {
      setMessage("The selected file is empty.");
      return;
    }
    if (file.size > MAX_PLAINTEXT_BYTES + 2048) {
      setMessage("Choose a file no larger than 100 MB.");
      return;
    }
    if (!password) {
      setMessage("Enter the password for this file.");
      return;
    }
    if (action === "encrypt" && password !== confirmation) {
      setMessage("The passwords do not match.");
      return;
    }

    setBusy(true);
    clearResult();
    try {
      const buffer = await file.arrayBuffer();
      const response = await new Promise<{ buffer: ArrayBuffer; filename?: string }>((resolve, reject) => {
        const worker = new Worker(new URL("../../lib/workers/file-encryption.worker.ts", import.meta.url), { type: "module" });
        worker.onmessage = (event: MessageEvent<{ buffer?: ArrayBuffer; filename?: string; error?: string }>) => {
          worker.terminate();
          if (event.data.buffer) resolve({ buffer: event.data.buffer, filename: event.data.filename });
          else reject(new Error(event.data.error ?? "File processing failed."));
        };
        worker.onerror = () => {
          worker.terminate();
          reject(new Error("The encryption worker could not start."));
        };
        worker.postMessage(
          action === "encrypt"
            ? { action, buffer, filename: file.name, password }
            : { action, buffer, password },
          [buffer],
        );
      });

      const name = action === "encrypt" ? encryptedFilename(file.name) : (response.filename ?? "decrypted-file");
      const blob = new Blob([response.buffer], { type: "application/octet-stream" });
      setResult({ url: URL.createObjectURL(blob), name, size: blob.size, action });
      setPassword("");
      setConfirmation("");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "File processing failed.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setFile(null);
    setPassword("");
    setConfirmation("");
    clearResult();
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

      <div className="mt-6">
        <label htmlFor="encryption-file" className="text-sm font-semibold">
          {action === "encrypt" ? "File to encrypt" : "NoTrak file to decrypt"}
        </label>
        <Input
          id="encryption-file"
          className="mt-2 h-11 cursor-pointer pt-2"
          type="file"
          accept={action === "decrypt" ? ".notrak,application/octet-stream" : undefined}
          onChange={(event) => { setFile(event.target.files?.[0] ?? null); clearResult(); }}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          {file ? `${file.name} · ${formatByteSize(file.size)}` : "Maximum file size: 100 MB"}
        </p>
      </div>

      <div className="mt-5">
        <label htmlFor="encryption-password" className="text-sm font-semibold">Password or passphrase</label>
        <div className="mt-2 flex gap-2">
          <Input
            id="encryption-password"
            className="h-11"
            type={showPassword ? "text" : "password"}
            value={password}
            autoComplete="new-password"
            onChange={(event) => { setPassword(event.target.value); clearResult(); }}
          />
          <Button className="h-11 px-3" variant="outline" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Hide password" : "Show password"}>
            {showPassword ? <EyeOff /> : <Eye />}
          </Button>
        </div>
        {action === "encrypt" && <p className="mt-2 text-xs leading-5 text-muted-foreground">Use at least 12 characters. NoTrak cannot recover a forgotten password.</p>}
      </div>

      {action === "encrypt" && (
        <div className="mt-5">
          <label htmlFor="encryption-password-confirm" className="text-sm font-semibold">Confirm password</label>
          <Input
            id="encryption-password-confirm"
            className="mt-2 h-11"
            type={showPassword ? "text" : "password"}
            value={confirmation}
            autoComplete="new-password"
            onChange={(event) => { setConfirmation(event.target.value); clearResult(); }}
          />
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <Button className="h-10 px-4" onClick={processFile} disabled={busy}>
          <FileKey2 aria-hidden="true" /> {busy ? `${action === "encrypt" ? "Encrypting" : "Decrypting"}…` : `${action === "encrypt" ? "Encrypt" : "Decrypt"} file`}
        </Button>
        {(file || result) && <Button className="h-10 px-4" variant="outline" onClick={reset}><RotateCcw /> Reset</Button>}
      </div>

      {result && (
        <div className="mt-7 rounded-2xl border border-primary/20 bg-primary/6 p-5" aria-live="polite">
          <p className="font-semibold">{result.action === "encrypt" ? "Encrypted file ready" : "Decrypted file ready"}</p>
          <p className="mt-1 text-sm text-muted-foreground">{result.name} · {formatByteSize(result.size)}</p>
          <Button className="mt-4 h-10 px-4" nativeButton={false} render={<a href={result.url} download={result.name} />}>
            <Download aria-hidden="true" /> Download file
          </Button>
        </div>
      )}

      <p className="mt-4 min-h-5 text-sm text-destructive" role="alert" aria-live="polite">{message}</p>
      <div className="mt-2 rounded-xl bg-muted/70 p-4 text-xs leading-5 text-muted-foreground">
        Format: NoTrak v1 · AES-256-GCM · PBKDF2-HMAC-SHA-256 · 600,000 iterations. The encrypted file authenticates its contents and original filename.
      </div>
    </div>
  );
}
