"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Download, FileText, RotateCcw, RotateCw, ScanText, Trash2 } from "lucide-react";

import { FileDrop } from "@/components/file-drop";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { SelectField } from "@/components/ui/select";
import { formatByteSize } from "@/lib/crypto/hash";
import { ocrStatusLabel } from "@/lib/images/ocr";
import {
  MAX_SCANNER_IMAGES,
  moveScannerPage,
  rotateScannerPage,
  scannerPdfName,
  validateScannerDimensions,
  validateScannerFiles,
  type ScannerEnhancement,
  type ScannerPageSize,
  type ScannerPdfPage,
  type ScannerRotation,
} from "@/lib/pdf/document-scanner";

type SelectedPage = {
  id: string;
  file: File;
  url: string;
  width: number;
  height: number;
  rotation: ScannerRotation;
  enhancement: ScannerEnhancement;
};

type Result = { url: string; size: number; pageCount: number; searchable: boolean };

const PAGE_SIZE_OPTIONS = [
  { value: "a4", label: "A4" },
  { value: "letter", label: "US Letter" },
] as const;

const ENHANCEMENT_OPTIONS = [
  { value: "original", label: "Original color" },
  { value: "grayscale", label: "Grayscale" },
  { value: "document", label: "Document contrast" },
] as const;

function canvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("The browser could not prepare an image page.")),
      "image/jpeg",
      0.9,
    );
  });
}

async function preparePage(page: SelectedPage) {
  const bitmap = await createImageBitmap(page.file);
  try {
    const sideways = page.rotation === 90 || page.rotation === 270;
    const sourceWidth = sideways ? bitmap.height : bitmap.width;
    const sourceHeight = sideways ? bitmap.width : bitmap.height;
    const scale = Math.min(1, 3000 / Math.max(sourceWidth, sourceHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const context = canvas.getContext("2d", { willReadFrequently: page.enhancement !== "original" });
    if (!context) throw new Error("This browser could not prepare an image page.");

    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate((page.rotation * Math.PI) / 180);
    context.drawImage(bitmap, -bitmap.width * scale / 2, -bitmap.height * scale / 2, bitmap.width * scale, bitmap.height * scale);
    context.setTransform(1, 0, 0, 1, 0, 0);

    if (page.enhancement !== "original") {
      const image = context.getImageData(0, 0, canvas.width, canvas.height);
      for (let index = 0; index < image.data.length; index += 4) {
        const gray = Math.round(image.data[index] * 0.299 + image.data[index + 1] * 0.587 + image.data[index + 2] * 0.114);
        const value = page.enhancement === "document"
          ? Math.max(0, Math.min(255, Math.round((gray - 128) * 1.65 + 140)))
          : gray;
        image.data[index] = value;
        image.data[index + 1] = value;
        image.data[index + 2] = value;
        image.data[index + 3] = 255;
      }
      context.putImageData(image, 0, 0);
    }

    const blob = await canvasBlob(canvas);
    return { blob, width: canvas.width, height: canvas.height };
  } finally {
    bitmap.close();
  }
}

export function DocumentScanner() {
  const workerRef = useRef<Awaited<ReturnType<typeof import("tesseract.js")["createWorker"]>> | null>(null);
  const pagesRef = useRef<SelectedPage[]>([]);
  const [pages, setPages] = useState<SelectedPage[]>([]);
  const [pageSize, setPageSize] = useState<ScannerPageSize>("a4");
  const [searchable, setSearchable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => { pagesRef.current = pages; }, [pages]);
  useEffect(() => () => {
    void workerRef.current?.terminate();
    pagesRef.current.forEach((page) => URL.revokeObjectURL(page.url));
  }, []);
  useEffect(() => {
    const url = result?.url;
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [result?.url]);

  function clearResult() {
    setResult(null);
    setProgress(0);
    setStatus("");
  }

  async function addFiles(nextFiles: File[]) {
    setMessage("");
    clearResult();
    try {
      const combined = [...pages.map((page) => page.file), ...nextFiles];
      validateScannerFiles(combined);
      const added: SelectedPage[] = [];
      for (const file of nextFiles) {
        const bitmap = await createImageBitmap(file);
        const width = bitmap.width;
        const height = bitmap.height;
        bitmap.close();
        validateScannerDimensions(width, height);
        added.push({
          id: crypto.randomUUID(),
          file,
          url: URL.createObjectURL(file),
          width,
          height,
          rotation: 0,
          enhancement: "document",
        });
      }
      setPages((current) => [...current, ...added]);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "The selected images could not be read.");
    }
  }

  function updatePages(next: SelectedPage[]) {
    clearResult();
    setMessage("");
    setPages(next);
  }

  function updatePage(id: string, patch: Partial<Pick<SelectedPage, "rotation" | "enhancement">>) {
    updatePages(pages.map((page) => page.id === id ? { ...page, ...patch } : page));
  }

  function removePage(id: string) {
    const removed = pages.find((page) => page.id === id);
    if (removed) URL.revokeObjectURL(removed.url);
    updatePages(pages.filter((page) => page.id !== id));
  }

  async function getOcrWorker() {
    if (workerRef.current) return workerRef.current;
    setStatus("Loading the local OCR engine");
    const Tesseract = await import("tesseract.js");
    const worker = await Tesseract.createWorker("eng", Tesseract.OEM.LSTM_ONLY, {
      workerPath: "/ocr/worker.min.js",
      corePath: "/ocr/core",
      langPath: "/ocr/lang",
      logger: ({ status: nextStatus }) => setStatus(ocrStatusLabel(nextStatus)),
    });
    await worker.setParameters({ preserve_interword_spaces: "1", user_defined_dpi: "300" });
    workerRef.current = worker;
    return worker;
  }

  async function exportPdf() {
    if (pages.length === 0) {
      setMessage("Add at least one image page first.");
      return;
    }
    setBusy(true);
    setMessage("");
    clearResult();
    try {
      const prepared: ScannerPdfPage[] = [];
      const ocrWorker = searchable ? await getOcrWorker() : null;
      for (let index = 0; index < pages.length; index += 1) {
        setStatus(`Preparing page ${index + 1} of ${pages.length}`);
        setProgress(Math.round((index / pages.length) * 80));
        const image = await preparePage(pages[index]);
        let ocrText = "";
        if (ocrWorker) {
          setStatus(`Reading text on page ${index + 1} of ${pages.length}`);
          const recognized = await ocrWorker.recognize(image.blob);
          ocrText = recognized.data.text.trim();
        }
        prepared.push({ bytes: await image.blob.arrayBuffer(), width: image.width, height: image.height, ocrText });
      }

      setStatus("Creating and verifying the PDF");
      setProgress(90);
      const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const worker = new Worker(new URL("../../lib/workers/document-scanner.worker.ts", import.meta.url), { type: "module" });
        worker.onmessage = (event: MessageEvent<{ buffer?: ArrayBuffer; error?: string }>) => {
          worker.terminate();
          if (event.data.buffer) resolve(event.data.buffer);
          else reject(new Error(event.data.error ?? "The PDF could not be created."));
        };
        worker.onerror = () => {
          worker.terminate();
          reject(new Error("The PDF worker could not start."));
        };
        worker.postMessage({ pages: prepared, pageSize }, prepared.map((page) => page.bytes));
      });
      const blob = new Blob([buffer], { type: "application/pdf" });
      setResult({ url: URL.createObjectURL(blob), size: blob.size, pageCount: pages.length, searchable });
      setProgress(100);
      setStatus("Document ready");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "The document could not be created.");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    pages.forEach((page) => URL.revokeObjectURL(page.url));
    setPages([]);
    setPageSize("a4");
    setSearchable(false);
    setMessage("");
    clearResult();
  }

  return (
    <div>
      <div className="callout-info">
        <strong>Processed locally.</strong> Photos, OCR text, and the finished PDF stay in this browser. Re-encoding also removes common camera metadata from the exported pages.
      </div>

      <div className="mt-6">
        <FileDrop
          label="Document photos"
          hint={`JPEG, PNG, or WebP · up to ${MAX_SCANNER_IMAGES} pages · 15 MB each · 60 MB total`}
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          multiple
          disabled={busy}
          onFiles={(files) => void addFiles(files)}
        />
      </div>

      {pages.length > 0 && (
        <section className="mt-7 border-t border-border/70 pt-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Arrange and clean pages</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Move pages into order, rotate sideways photos, and choose the treatment for each page.</p>
            </div>
            <span className="text-xs text-muted-foreground">{pages.length} of {MAX_SCANNER_IMAGES} pages</span>
          </div>

          <ol className="mt-4 grid gap-3" aria-label="Document pages">
            {pages.map((page, index) => {
              const label = `${page.file.name}, page ${index + 1}`;
              return (
                <li key={page.id} className="grid gap-3 rounded-2xl border border-border/80 bg-muted/20 p-3 sm:grid-cols-[6rem_1fr] sm:items-center">
                  <div className="relative mx-auto aspect-[3/4] w-24 overflow-hidden rounded-lg border border-border bg-white">
                    <Image
                      unoptimized
                      fill
                      sizes="96px"
                      src={page.url}
                      alt={`Preview of ${page.file.name}`}
                      className="object-contain"
                      style={{ transform: `rotate(${page.rotation}deg)` }}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="break-all text-sm font-medium">{index + 1}. {page.file.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{page.width} × {page.height} · {formatByteSize(page.file.size)}{page.rotation ? ` · rotated ${page.rotation}°` : ""}</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(10rem,1fr)_auto] sm:items-end">
                      <SelectField
                        id={`scanner-enhancement-${page.id}`}
                        label={`Treatment for page ${index + 1}`}
                        value={page.enhancement}
                        options={ENHANCEMENT_OPTIONS}
                        disabled={busy}
                        onValueChange={(enhancement) => updatePage(page.id, { enhancement })}
                      />
                      <div className="flex flex-wrap gap-1" aria-label={`Actions for ${label}`}>
                        <Button type="button" size="icon" variant="outline" aria-label={`Move ${label} up`} disabled={index === 0 || busy} onClick={() => updatePages(moveScannerPage(pages, index, index - 1))}><ArrowUp /></Button>
                        <Button type="button" size="icon" variant="outline" aria-label={`Move ${label} down`} disabled={index === pages.length - 1 || busy} onClick={() => updatePages(moveScannerPage(pages, index, index + 1))}><ArrowDown /></Button>
                        <Button type="button" size="icon" variant="outline" aria-label={`Rotate ${label} clockwise`} disabled={busy} onClick={() => updatePage(page.id, { rotation: rotateScannerPage(page.rotation) })}><RotateCw /></Button>
                        <Button type="button" size="icon" variant="destructive" aria-label={`Remove ${label}`} disabled={busy} onClick={() => removePage(page.id)}><Trash2 /></Button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <SelectField
              id="scanner-page-size"
              label="PDF page size"
              value={pageSize}
              options={PAGE_SIZE_OPTIONS}
              disabled={busy}
              onValueChange={(value) => { setPageSize(value); clearResult(); }}
              description="Each image is centered and fitted with a small white margin."
            />
            <label className="flex items-start gap-3 rounded-xl border border-border/80 p-3 text-sm leading-6">
              <input className="mt-1 size-4 accent-primary" type="checkbox" checked={searchable} disabled={busy} onChange={(event) => { setSearchable(event.target.checked); clearResult(); }} />
              <span><strong>Add searchable English text</strong><br /><span className="text-xs text-muted-foreground">Uses the bundled OCR engine. It takes longer and printed-text recognition can contain mistakes.</span></span>
            </label>
          </div>
        </section>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <Button type="button" className="h-10 px-4" disabled={busy || pages.length === 0} onClick={() => void exportPdf()}><ScanText /> {busy ? "Creating document…" : "Create private PDF"}</Button>
        {pages.length > 0 && <Button type="button" className="h-10 px-4" variant="outline" disabled={busy} onClick={reset}><RotateCcw /> Reset</Button>}
      </div>

      {busy && (
        <div className="mt-5" aria-live="polite">
          <div className="flex justify-between gap-3 text-sm"><span>{status}</span><span>{progress}%</span></div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-[width] motion-reduce:transition-none" style={{ width: `${progress}%` }} /></div>
        </div>
      )}

      {result && (
        <section className="result-enter mt-7 rounded-2xl border border-primary/20 bg-primary/6 p-5" aria-live="polite">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary"><FileText /></span>
            <div>
              <h2 className="font-semibold">Private PDF ready</h2>
              <p className="mt-1 text-sm text-muted-foreground">{result.pageCount} page{result.pageCount === 1 ? "" : "s"} · {formatByteSize(result.size)} · {result.searchable ? "searchable English text added" : "image-only PDF"}</p>
            </div>
          </div>
          <Button className="mt-4 h-10 px-4" nativeButton={false} render={<a href={result.url} download={scannerPdfName()} />}><Download /> Download scanned PDF</Button>
        </section>
      )}

      <FeedbackMessage tone="error" className="mt-4">{message}</FeedbackMessage>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">Document contrast works best on dark text over pale paper. Always review the downloaded PDF and OCR text before relying on it.</p>
    </div>
  );
}
