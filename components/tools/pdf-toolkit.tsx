"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Download,
  Files,
  RotateCcw,
  RotateCw,
  Scissors,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatByteSize } from "@/lib/crypto/hash";
import {
  combinedPdfName,
  MAX_PDF_SPLIT_PAGES,
  movePdfToolkitPage,
  rotatePdfToolkitPage,
  validatePdfSignature,
  validatePdfToolkitFiles,
  type PdfToolkitPage,
} from "@/lib/pdf/toolkit";

type CombinedResult = { url: string; name: string; size: number };
type SplitResult = { url: string; name: string; size: number };
type WorkerSuccess =
  | { action: "inspect"; pages: PdfToolkitPage[] }
  | { action: "combine"; buffer: ArrayBuffer }
  | { action: "split"; results: Array<{ buffer: ArrayBuffer; name: string }> };
type WorkerResponse = WorkerSuccess | { error: string };

export function PdfToolkit() {
  const inputRef = useRef<HTMLInputElement>(null);
  const selectionRef = useRef(0);
  const [files, setFiles] = useState<File[]>([]);
  const [pages, setPages] = useState<PdfToolkitPage[]>([]);
  const [combined, setCombined] = useState<CombinedResult | null>(null);
  const [split, setSplit] = useState<SplitResult[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const combinedUrl = combined?.url;
    const splitUrls = split.map((result) => result.url);
    return () => {
      if (combinedUrl) URL.revokeObjectURL(combinedUrl);
      for (const url of splitUrls) URL.revokeObjectURL(url);
    };
  }, [combined?.url, split]);

  function clearResults() {
    setCombined(null);
    setSplit([]);
    setMessage("");
  }

  async function runWorker(request: object, buffers: ArrayBuffer[]) {
    return new Promise<WorkerSuccess>((resolve, reject) => {
      const worker = new Worker(new URL("../../lib/workers/pdf-toolkit.worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        worker.terminate();
        const data = event.data;
        if ("error" in data) reject(new Error(data.error));
        else resolve(data);
      };
      worker.onerror = () => {
        worker.terminate();
        reject(new Error("The PDF worker could not start."));
      };
      worker.postMessage(request, buffers);
    });
  }

  async function readFiles(selected: File[]) {
    const buffers = await Promise.all(selected.map((file) => file.arrayBuffer()));
    for (let index = 0; index < selected.length; index += 1) {
      validatePdfSignature(buffers[index], selected[index].name);
    }
    return buffers;
  }

  async function chooseFiles(selected: File[]) {
    const selection = selectionRef.current + 1;
    selectionRef.current = selection;
    clearResults();
    setFiles([]);
    setPages([]);
    if (selected.length === 0) return;

    setBusy(true);
    try {
      validatePdfToolkitFiles(selected);
      const buffers = await readFiles(selected);
      const response = await runWorker(
        { action: "inspect", buffers, names: selected.map((file) => file.name) },
        buffers,
      );
      if (selectionRef.current !== selection || response.action !== "inspect") return;
      setFiles(selected);
      setPages(response.pages);
    } catch (reason) {
      if (selectionRef.current !== selection) return;
      setMessage(reason instanceof Error ? reason.message : "The PDFs could not be read.");
      if (inputRef.current) inputRef.current.value = "";
    } finally {
      if (selectionRef.current === selection) setBusy(false);
    }
  }

  async function createCombinedPdf() {
    if (files.length === 0 || pages.length === 0) {
      setMessage("Keep at least one page before creating a PDF.");
      return;
    }

    setBusy(true);
    clearResults();
    try {
      const buffers = await readFiles(files);
      const response = await runWorker({ action: "combine", buffers, pages }, buffers);
      if (response.action !== "combine") throw new Error("The combined PDF could not be created.");
      const blob = new Blob([response.buffer], { type: "application/pdf" });
      setCombined({
        url: URL.createObjectURL(blob),
        name: combinedPdfName(files.map((file) => file.name)),
        size: blob.size,
      });
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "The combined PDF could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function createSplitPdfs() {
    if (files.length === 0 || pages.length === 0) {
      setMessage("Keep at least one page before creating separate PDFs.");
      return;
    }
    if (pages.length > MAX_PDF_SPLIT_PAGES) {
      setMessage(`Separate-page export supports up to ${MAX_PDF_SPLIT_PAGES} selected pages at once.`);
      return;
    }

    setBusy(true);
    clearResults();
    try {
      const buffers = await readFiles(files);
      const response = await runWorker({ action: "split", buffers, pages }, buffers);
      if (response.action !== "split") throw new Error("The separate PDFs could not be created.");
      setSplit(response.results.map((result) => {
        const blob = new Blob([result.buffer], { type: "application/pdf" });
        return { url: URL.createObjectURL(blob), name: result.name, size: blob.size };
      }));
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "The separate PDFs could not be created.");
    } finally {
      setBusy(false);
    }
  }

  function updatePages(next: PdfToolkitPage[]) {
    setPages(next);
    clearResults();
  }

  function reset() {
    selectionRef.current += 1;
    setFiles([]);
    setPages([]);
    setBusy(false);
    clearResults();
    if (inputRef.current) inputRef.current.value = "";
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);

  return (
    <div>
      <div className="callout-info">
        <strong>Processed locally.</strong> Selected PDFs are read and rewritten in this browser. No document or page
        content is uploaded to NoTrak.
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-3" aria-label="PDF Toolkit capabilities">
        <div className="rounded-xl border border-border/80 bg-muted/25 p-3">
          <p className="text-sm font-semibold">Merge PDFs</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Choose two or more documents and combine their pages.</p>
        </div>
        <div className="rounded-xl border border-border/80 bg-muted/25 p-3">
          <p className="text-sm font-semibold">Extract and arrange</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Reorder, rotate, or remove pages before export.</p>
        </div>
        <div className="rounded-xl border border-border/80 bg-muted/25 p-3">
          <p className="text-sm font-semibold">Split pages</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Prepare each selected page as a separate PDF.</p>
        </div>
      </div>

      <label htmlFor="pdf-toolkit-files" className="mt-6 block text-sm font-semibold">PDF documents to merge or edit</label>
      <Input
        ref={inputRef}
        id="pdf-toolkit-files"
        className="mt-2 h-11 cursor-pointer pt-2"
        type="file"
        accept="application/pdf,.pdf"
        multiple
        disabled={busy}
        onChange={(event) => void chooseFiles(Array.from(event.target.files ?? []))}
      />
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        Up to 10 documents, 50 MB each, 100 MB total, and 100 pages. Password-protected PDFs are not supported.
      </p>

      {files.length > 0 && (
        <>
          <p className="mt-3 text-sm font-medium" aria-live="polite">
            {files.length} document{files.length === 1 ? "" : "s"} · {pages.length} selected page{pages.length === 1 ? "" : "s"} · {formatByteSize(totalSize)}
          </p>

          <section className="mt-7 border-t border-border/70 pt-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Arrange pages</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Move, rotate, or remove pages. To extract only certain pages, remove the rest and create a combined
                  PDF. The order below becomes the order in the new document.
                </p>
              </div>
              <span className="text-xs text-muted-foreground">{pages.length} of 100 pages</span>
            </div>

            {pages.length > 0 ? (
              <ol className="mt-4 grid gap-2" aria-label="Selected PDF pages">
                {pages.map((page, index) => {
                  const label = `${page.sourceName}, page ${page.originalPageNumber}`;
                  return (
                    <li key={page.id} className="flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-border/80 bg-muted/25 p-3">
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                        {index + 1}
                      </span>
                      <div className="min-w-40 flex-1">
                        <p className="break-all text-sm font-medium">{page.sourceName}</p>
                        <p className="text-xs text-muted-foreground">
                          Original page {page.originalPageNumber}{page.rotation ? ` · Rotated ${page.rotation}°` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1" aria-label={`Actions for ${label}`}>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          aria-label={`Move ${label} up`}
                          disabled={index === 0 || busy}
                          onClick={() => updatePages(movePdfToolkitPage(pages, index, index - 1))}
                        ><ArrowUp aria-hidden="true" /></Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          aria-label={`Move ${label} down`}
                          disabled={index === pages.length - 1 || busy}
                          onClick={() => updatePages(movePdfToolkitPage(pages, index, index + 1))}
                        ><ArrowDown aria-hidden="true" /></Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          aria-label={`Rotate ${label} clockwise`}
                          disabled={busy}
                          onClick={() => updatePages(pages.map((entry) => entry.id === page.id ? rotatePdfToolkitPage(entry, 90) : entry))}
                        ><RotateCw aria-hidden="true" /></Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="destructive"
                          aria-label={`Remove ${label}`}
                          disabled={busy}
                          onClick={() => updatePages(pages.filter((entry) => entry.id !== page.id))}
                        ><Trash2 aria-hidden="true" /></Button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
                Every page was removed. Reset and select the documents again to restore them.
              </div>
            )}
          </section>
        </>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <Button type="button" className="h-10 px-4" onClick={createCombinedPdf} disabled={busy || pages.length === 0}>
          <Files aria-hidden="true" /> {busy ? "Working…" : files.length > 1 ? "Merge selected PDFs" : "Export selected pages"}
        </Button>
        <Button type="button" className="h-10 px-4" variant="outline" onClick={createSplitPdfs} disabled={busy || pages.length === 0}>
          <Scissors aria-hidden="true" /> Prepare separate pages
        </Button>
        {(files.length > 0 || pages.length > 0) && (
          <Button type="button" className="h-10 px-4" variant="outline" onClick={reset} disabled={busy}>
            <RotateCcw aria-hidden="true" /> Reset
          </Button>
        )}
      </div>

      {combined && (
        <section className="mt-7 rounded-2xl border border-primary/20 bg-primary/6 p-5" aria-live="polite">
          <h2 className="font-semibold">{files.length > 1 ? "Merged PDF ready" : "PDF export ready"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{pages.length} pages · {formatByteSize(combined.size)}</p>
          <Button className="mt-4 h-10 px-4" nativeButton={false} render={<a href={combined.url} download={combined.name} />}>
            <Download aria-hidden="true" /> {files.length > 1 ? "Download merged PDF" : "Download PDF"}
          </Button>
        </section>
      )}

      {split.length > 0 && (
        <section className="mt-7 rounded-2xl border border-primary/20 bg-primary/6 p-5" aria-live="polite">
          <h2 className="font-semibold">Separate PDFs ready</h2>
          <p className="mt-1 text-sm text-muted-foreground">Download each selected page as its own document.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {split.map((result, index) => (
              <Button
                key={`${index}-${result.name}`}
                className="h-auto min-h-10 justify-start px-3 py-2"
                variant="outline"
                nativeButton={false}
                render={<a href={result.url} download={result.name} />}
              >
                <Download aria-hidden="true" /> <span className="min-w-0 truncate">{result.name}</span>
              </Button>
            ))}
          </div>
        </section>
      )}

      <p className="mt-4 min-h-5 text-sm text-destructive" role="alert" aria-live="polite">{message}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Rebuilding pages may invalidate digital signatures and may not preserve interactive forms, bookmarks,
        attachments, scripts, or other document-level features. Review the new PDF before relying on it.
      </p>
    </div>
  );
}
