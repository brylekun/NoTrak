"use client";

import { useEffect, useRef, useState } from "react";
import { Archive, Download, FileArchive, PackageOpen, RotateCcw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import {
  MAX_ZIP_FILES,
  validateZipSources,
  zipDownloadName,
  type ZipEntry,
} from "@/lib/archive/zip";
import { formatByteSize } from "@/lib/crypto/hash";

type Mode = "create" | "extract";
type CreatedArchive = { url: string; name: string; size: number };
type ExtractedFile = ZipEntry & { url: string; downloadName: string };
type WorkerResponse =
  | { action: "create"; buffer: ArrayBuffer }
  | { action: "inspect"; entries: ZipEntry[]; extractedBytes: number }
  | { action: "extract"; entries: Array<ZipEntry & { buffer: ArrayBuffer; downloadName: string }> }
  | { error: string };

const COMPRESSION_OPTIONS = [
  { value: 0, label: "Store only (fastest)" },
  { value: 6, label: "Balanced compression" },
  { value: 9, label: "Maximum compression" },
] as const;

export function ZipToolkit() {
  const createInputRef = useRef<HTMLInputElement>(null);
  const extractInputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const [mode, setMode] = useState<Mode>("create");
  const [files, setFiles] = useState<File[]>([]);
  const [archiveName, setArchiveName] = useState("notrak-files");
  const [compression, setCompression] = useState<0 | 6 | 9>(6);
  const [created, setCreated] = useState<CreatedArchive | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<{ entries: ZipEntry[]; extractedBytes: number } | null>(null);
  const [extracted, setExtracted] = useState<ExtractedFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"neutral" | "success" | "error">("neutral");

  useEffect(() => () => workerRef.current?.terminate(), []);
  useEffect(() => {
    const createdUrl = created?.url;
    const extractedUrls = extracted.map((entry) => entry.url);
    return () => {
      if (createdUrl) URL.revokeObjectURL(createdUrl);
      for (const url of extractedUrls) URL.revokeObjectURL(url);
    };
  }, [created?.url, extracted]);

  function runWorker(request: object, transfer: Transferable[] = []) {
    workerRef.current?.terminate();
    return new Promise<Exclude<WorkerResponse, { error: string }>>((resolve, reject) => {
      const worker = new Worker(new URL("../../lib/workers/zip-toolkit.worker.ts", import.meta.url), { type: "module" });
      workerRef.current = worker;
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        worker.terminate();
        workerRef.current = null;
        if ("error" in event.data) reject(new Error(event.data.error));
        else resolve(event.data);
      };
      worker.onerror = () => {
        worker.terminate();
        workerRef.current = null;
        reject(new Error("The local ZIP worker could not start."));
      };
      worker.postMessage(request, transfer);
    });
  }

  function clearResults() {
    setCreated(null);
    setExtracted([]);
    setMessage("");
  }

  function switchMode(nextMode: Mode) {
    if (busy || nextMode === mode) return;
    setMode(nextMode);
    setMessage("");
  }

  function chooseCreateFiles(selected: File[]) {
    clearResults();
    if (selected.length === 0) {
      setFiles([]);
      if (createInputRef.current) createInputRef.current.value = "";
      return;
    }
    try {
      validateZipSources(selected);
      setFiles(selected);
      if (selected.length === 1) setArchiveName(selected[0].name.replace(/\.[^.]+$/u, "") || "archive");
      setTone("neutral");
      setMessage(`${selected.length} file${selected.length === 1 ? "" : "s"} ready to compress locally.`);
    } catch (reason) {
      setFiles([]);
      setTone("error");
      setMessage(reason instanceof Error ? reason.message : "The selected files cannot be added.");
      if (createInputRef.current) createInputRef.current.value = "";
    }
  }

  async function createArchive() {
    try {
      validateZipSources(files);
      setBusy(true);
      clearResults();
      const buffers = await Promise.all(files.map((file) => file.arrayBuffer()));
      const response = await runWorker({
        action: "create",
        level: compression,
        files: files.map((file, index) => ({ name: file.name, size: file.size, buffer: buffers[index] })),
      }, buffers);
      if (response.action !== "create") throw new Error("The ZIP archive could not be created.");
      const blob = new Blob([response.buffer], { type: "application/zip" });
      setCreated({ url: URL.createObjectURL(blob), name: zipDownloadName(archiveName), size: blob.size });
      setTone("success");
      setMessage("ZIP ready. The original files were not changed.");
    } catch (reason) {
      setTone("error");
      setMessage(reason instanceof Error ? reason.message : "The ZIP archive could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function chooseZip(selected: File | null) {
    setZipFile(null);
    setSummary(null);
    clearResults();
    if (!selected) return;
    if (!selected.name.toLocaleLowerCase("en-US").endsWith(".zip")) {
      setTone("error");
      setMessage("Choose a file ending in .zip.");
      if (extractInputRef.current) extractInputRef.current.value = "";
      return;
    }
    setBusy(true);
    try {
      const buffer = await selected.arrayBuffer();
      const response = await runWorker({ action: "inspect", buffer }, [buffer]);
      if (response.action !== "inspect") throw new Error("The ZIP archive could not be inspected.");
      setZipFile(selected);
      setSummary({ entries: response.entries, extractedBytes: response.extractedBytes });
      setTone("neutral");
      setMessage("Archive structure checked. Review the file list before extracting it.");
    } catch (reason) {
      setTone("error");
      setMessage(reason instanceof Error ? reason.message : "The ZIP archive could not be inspected.");
      if (extractInputRef.current) extractInputRef.current.value = "";
    } finally {
      setBusy(false);
    }
  }

  async function extractArchive() {
    if (!zipFile || !summary) return;
    setBusy(true);
    clearResults();
    try {
      const buffer = await zipFile.arrayBuffer();
      const response = await runWorker({ action: "extract", buffer }, [buffer]);
      if (response.action !== "extract") throw new Error("The ZIP archive could not be extracted.");
      setExtracted(response.entries.map((entry) => ({
        path: entry.path,
        size: entry.size,
        compressedSize: entry.compressedSize,
        downloadName: entry.downloadName,
        url: URL.createObjectURL(new Blob([entry.buffer])),
      })));
      setTone("success");
      setMessage(`${response.entries.length} file${response.entries.length === 1 ? " is" : "s are"} ready to download.`);
    } catch (reason) {
      setTone("error");
      setMessage(reason instanceof Error ? reason.message : "The ZIP archive could not be extracted.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    workerRef.current?.terminate();
    workerRef.current = null;
    setFiles([]);
    setZipFile(null);
    setSummary(null);
    setCreated(null);
    setExtracted([]);
    setBusy(false);
    setMessage("");
    if (createInputRef.current) createInputRef.current.value = "";
    if (extractInputRef.current) extractInputRef.current.value = "";
  }

  const selectedBytes = files.reduce((sum, file) => sum + file.size, 0);

  return (
    <div>
      <div className="callout-info text-sm leading-6">
        <strong>Processed locally.</strong> Files are compressed and extracted in a browser worker. No archive or
        filename is uploaded, and original files remain unchanged.
      </div>

      <div className="mt-6 grid grid-cols-2 rounded-xl border border-border/80 bg-muted/30 p-1" aria-label="ZIP operation">
        <Button type="button" className="h-10" variant={mode === "create" ? "default" : "ghost"} aria-pressed={mode === "create"} disabled={busy} onClick={() => switchMode("create")}>
          <Archive aria-hidden="true" /> Create ZIP
        </Button>
        <Button type="button" className="h-10" variant={mode === "extract" ? "default" : "ghost"} aria-pressed={mode === "extract"} disabled={busy} onClick={() => switchMode("extract")}>
          <PackageOpen aria-hidden="true" /> Extract ZIP
        </Button>
      </div>

      {mode === "create" ? (
        <section className="mt-6" aria-labelledby="create-zip-heading">
          <h2 id="create-zip-heading" className="text-lg font-semibold">Create an archive</h2>
          <label htmlFor="zip-create-files" className="mt-4 block text-sm font-semibold">Files to compress</label>
          <Input ref={createInputRef} id="zip-create-files" className="mt-2 h-11 cursor-pointer pt-2" type="file" multiple disabled={busy} onChange={(event) => chooseCreateFiles(Array.from(event.target.files ?? []))} />
          <p className="mt-2 text-xs leading-5 text-muted-foreground">Up to {MAX_ZIP_FILES} files, 100 MB each, and 200 MB total. Folder selection and encrypted archives are not included.</p>

          {files.length > 0 && (
            <div className="mt-5">
              <p className="text-sm font-medium">{files.length} file{files.length === 1 ? "" : "s"} · {formatByteSize(selectedBytes)}</p>
              <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto" aria-label="Files to compress">
                {files.map((file, index) => (
                  <li key={`${file.name}-${file.size}-${index}`} className="flex min-w-0 items-center gap-3 rounded-xl border border-border/70 bg-muted/20 p-3">
                    <FileArchive className="size-4 shrink-0 text-primary" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-sm" title={file.name}>{file.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatByteSize(file.size)}</span>
                    <Button type="button" size="icon" variant="destructive" aria-label={`Remove ${file.name}`} disabled={busy} onClick={() => chooseCreateFiles(files.filter((_, fileIndex) => fileIndex !== index))}><Trash2 aria-hidden="true" /></Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="zip-name" className="text-sm font-semibold">Archive name</label>
              <Input id="zip-name" className="mt-2" value={archiveName} maxLength={100} disabled={busy} onChange={(event) => { setArchiveName(event.target.value); setCreated(null); }} />
            </div>
            <SelectField label="Compression" value={compression} options={COMPRESSION_OPTIONS} disabled={busy} onValueChange={(value) => { setCompression(value); setCreated(null); }} />
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button type="button" className="h-10 px-4" disabled={busy || files.length === 0} onClick={() => void createArchive()}><Archive aria-hidden="true" />{busy ? "Creating ZIP…" : "Create ZIP"}</Button>
            {files.length > 0 && <Button type="button" className="h-10 px-4" variant="outline" disabled={busy} onClick={reset}><RotateCcw aria-hidden="true" /> Reset</Button>}
          </div>

          {created && (
            <section className="result-enter mt-7 rounded-2xl border border-primary/20 bg-primary/6 p-5" aria-live="polite">
              <h2 className="font-semibold">Archive ready</h2>
              <p className="mt-1 break-all text-sm text-muted-foreground">{created.name} · {formatByteSize(created.size)}</p>
              <Button className="mt-4 h-10 px-4" nativeButton={false} render={<a href={created.url} download={created.name} />}><Download aria-hidden="true" /> Download ZIP</Button>
            </section>
          )}
        </section>
      ) : (
        <section className="mt-6" aria-labelledby="extract-zip-heading">
          <h2 id="extract-zip-heading" className="text-lg font-semibold">Inspect and extract an archive</h2>
          <label htmlFor="zip-extract-file" className="mt-4 block text-sm font-semibold">ZIP archive</label>
          <Input ref={extractInputRef} id="zip-extract-file" className="mt-2 h-11 cursor-pointer pt-2" type="file" accept="application/zip,.zip" disabled={busy} onChange={(event) => void chooseZip(event.target.files?.[0] ?? null)} />
          <p className="mt-2 text-xs leading-5 text-muted-foreground">Before extraction, NoTrak checks file count, compression methods, unsafe paths, and expanded size. Password-protected, multi-part, and ZIP64 archives are not supported.</p>

          {summary && zipFile && (
            <div className="mt-5">
              <p className="text-sm font-medium">{summary.entries.length} file{summary.entries.length === 1 ? "" : "s"} · {formatByteSize(summary.extractedBytes)} after extraction</p>
              <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto" aria-label="Files inside ZIP archive">
                {summary.entries.map((entry, index) => (
                  <li key={`${entry.path}-${index}`} className="flex min-w-0 items-center gap-3 rounded-xl border border-border/70 bg-muted/20 p-3">
                    <FileArchive className="size-4 shrink-0 text-primary" aria-hidden="true" />
                    <span className="min-w-0 flex-1 break-all text-sm">{entry.path}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatByteSize(entry.size)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button type="button" className="h-10 px-4" disabled={busy} onClick={() => void extractArchive()}><PackageOpen aria-hidden="true" />{busy ? "Extracting…" : "Extract files"}</Button>
                <Button type="button" className="h-10 px-4" variant="outline" disabled={busy} onClick={reset}><RotateCcw aria-hidden="true" /> Reset</Button>
              </div>
            </div>
          )}

          {extracted.length > 0 && (
            <section className="result-enter mt-7 rounded-2xl border border-primary/20 bg-primary/6 p-5" aria-live="polite">
              <h2 className="font-semibold">Extracted files ready</h2>
              <p className="mt-1 text-sm text-muted-foreground">Download only the files you expect. Opening unknown archive contents can still be unsafe.</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {extracted.map((entry, index) => (
                  <Button key={`${entry.path}-${index}`} className="h-auto min-h-11 justify-start px-3 py-2" variant="outline" nativeButton={false} render={<a href={entry.url} download={entry.downloadName} />}>
                    <Download aria-hidden="true" /><span className="min-w-0 truncate">{entry.downloadName}</span>
                  </Button>
                ))}
              </div>
            </section>
          )}
        </section>
      )}

      <FeedbackMessage className="mt-4" tone={tone}>{message}</FeedbackMessage>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">ZIP compression is not encryption. Protect sensitive archives with File Encryption after creating them, and inspect unexpected archives before opening extracted files.</p>
    </div>
  );
}
