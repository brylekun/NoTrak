"use client";

import { useEffect, useState } from "react";
import { Download, FileCheck2, RotateCcw, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatByteSize } from "@/lib/crypto/hash";
import { cleanedPdfName, validatePdfFile } from "@/lib/pdf/metadata";

type Result = { url: string; name: string; size: number; pageCount: number; removedFields: number };

export function PdfMetadataCleaner() {
  const [file, setFile] = useState<File | null>(null);
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

  async function clean() {
    if (!file) {
      setMessage("Choose a PDF to clean.");
      return;
    }
    setBusy(true);
    clearResult();

    try {
      const buffer = await file.arrayBuffer();
      validatePdfFile(file, new Uint8Array(buffer, 0, Math.min(5, buffer.byteLength)));
      const cleaned = await new Promise<{ buffer: ArrayBuffer; pageCount: number; removedFields: number }>((resolve, reject) => {
        const worker = new Worker(new URL("../../lib/workers/pdf-metadata.worker.ts", import.meta.url), { type: "module" });
        worker.onmessage = (event: MessageEvent<{ buffer?: ArrayBuffer; pageCount?: number; removedFields?: number; error?: string }>) => {
          worker.terminate();
          if (event.data.buffer && event.data.pageCount !== undefined && event.data.removedFields !== undefined) {
            resolve({ buffer: event.data.buffer, pageCount: event.data.pageCount, removedFields: event.data.removedFields });
          } else reject(new Error(event.data.error ?? "PDF cleaning failed."));
        };
        worker.onerror = () => {
          worker.terminate();
          reject(new Error("The PDF worker could not start."));
        };
        worker.postMessage(buffer, [buffer]);
      });

      const blob = new Blob([cleaned.buffer], { type: "application/pdf" });
      setResult({
        url: URL.createObjectURL(blob),
        name: cleanedPdfName(file.name),
        size: blob.size,
        pageCount: cleaned.pageCount,
        removedFields: cleaned.removedFields,
      });
    } catch (reason) {
      const detail = reason instanceof Error ? reason.message : "PDF cleaning failed.";
      setMessage(detail.includes("encrypted") ? "Password-protected PDFs are not supported. Unlock a copy first." : detail);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label htmlFor="pdf-file" className="text-sm font-semibold">PDF to clean</label>
      <Input
        id="pdf-file"
        className="mt-2 h-11 cursor-pointer pt-2"
        type="file"
        accept="application/pdf,.pdf"
        onChange={(event) => { setFile(event.target.files?.[0] ?? null); clearResult(); }}
      />
      <p className="mt-2 text-xs leading-5 text-muted-foreground">PDF documents up to 50 MB. Password-protected documents are not supported.</p>
      {file && <p className="mt-2 text-sm font-medium">{file.name} · {formatByteSize(file.size)}</p>}

      <div className="mt-5 flex flex-wrap gap-2">
        <Button className="h-10 px-4" onClick={clean} disabled={busy}><FileCheck2 /> {busy ? "Cleaning and verifying…" : "Remove PDF metadata"}</Button>
        {(file || result) && <Button className="h-10 px-4" variant="outline" onClick={() => { setFile(null); clearResult(); }}><RotateCcw /> Reset</Button>}
      </div>

      {result && (
        <div className="mt-7 rounded-2xl border border-primary/20 bg-primary/6 p-5" aria-live="polite">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary"><ShieldCheck /></span>
            <div>
              <p className="font-semibold">Clean PDF verified</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Removed {result.removedFields} populated metadata field{result.removedFields === 1 ? "" : "s"} and verified the output contains no standard document-info or XMP metadata.</p>
              <p className="mt-2 text-xs text-muted-foreground">{result.pageCount} page{result.pageCount === 1 ? "" : "s"} · {formatByteSize(result.size)}</p>
            </div>
          </div>
          <Button className="mt-4 h-10 px-4" nativeButton={false} render={<a href={result.url} download={result.name} />}><Download /> Download clean PDF</Button>
        </div>
      )}

      <p className="mt-4 min-h-5 text-sm text-destructive" role="alert" aria-live="polite">{message}</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">This removes standard metadata, not visible names, comments, annotations, attachments, hidden layers, or text inside the document.</p>
    </div>
  );
}
