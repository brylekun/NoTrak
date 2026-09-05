"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { Check, ClipboardPaste, Copy, Download, FileImage, RotateCcw, RotateCw, ScanText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { COPY_FALLBACK_MESSAGE, copyToClipboard } from "@/lib/clipboard";
import {
  normalizeOcrCrop,
  ocrStatusLabel,
  ocrTextName,
  rotateOcrLeft,
  rotateOcrRight,
  validateOcrDimensions,
  validateOcrImage,
  type OcrCrop,
  type OcrDimensions,
  type OcrRotation,
} from "@/lib/images/ocr";

type SelectedImage = OcrDimensions & { file: File; url: string };

async function renderSelection(image: SelectedImage, crop: OcrCrop, rotation: OcrRotation) {
  const bitmap = await createImageBitmap(image.file);
  try {
    const sideways = rotation === 90 || rotation === 270;
    const canvas = document.createElement("canvas");
    canvas.width = sideways ? crop.height : crop.width;
    canvas.height = sideways ? crop.width : crop.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser could not prepare the image.");

    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate((rotation * Math.PI) / 180);
    context.drawImage(bitmap, crop.x, crop.y, crop.width, crop.height, -crop.width / 2, -crop.height / 2, crop.width, crop.height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("This browser could not prepare the image.")), "image/png");
    });
  } finally {
    bitmap.close();
  }
}

export function ImageToText() {
  const inputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Awaited<ReturnType<typeof import("tesseract.js")["createWorker"]>> | null>(null);
  const selectionIdRef = useRef(0);
  const [image, setImage] = useState<SelectedImage | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [crop, setCrop] = useState({ x: "0", y: "0", width: "", height: "" });
  const [rotation, setRotation] = useState<OcrRotation>(0);
  const [text, setText] = useState("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => () => { void workerRef.current?.terminate(); }, []);

  useEffect(() => {
    const sourceUrl = image?.url;
    return () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    };
  }, [image?.url]);

  useEffect(() => {
    if (!image) return;
    let active = true;
    let nextUrl = "";
    const timer = window.setTimeout(() => {
      try {
        const area = normalizeOcrCrop({
          x: Number(crop.x), y: Number(crop.y), width: Number(crop.width), height: Number(crop.height),
        }, image);
        void renderSelection(image, area, rotation).then((blob) => {
          if (!active) return;
          nextUrl = URL.createObjectURL(blob);
          setPreviewUrl((current) => {
            if (current) URL.revokeObjectURL(current);
            return nextUrl;
          });
        }).catch(() => undefined);
      } catch { /* Keep the last valid preview while crop fields are incomplete. */ }
    }, 120);
    return () => {
      active = false;
      window.clearTimeout(timer);
      if (nextUrl) URL.revokeObjectURL(nextUrl);
    };
  }, [crop.height, crop.width, crop.x, crop.y, image, rotation]);

  function clearResult() {
    setText("");
    setConfidence(null);
    setProgress(0);
    setStatus("");
    setCopied(false);
  }

  async function chooseImage(file: File | null) {
    const selectionId = selectionIdRef.current + 1;
    selectionIdRef.current = selectionId;
    setMessage("");
    clearResult();
    if (!file) return;
    try {
      validateOcrImage(file);
      const bitmap = await createImageBitmap(file);
      const dimensions = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      validateOcrDimensions(dimensions);
      if (selectionIdRef.current !== selectionId) return;
      if (image?.url) URL.revokeObjectURL(image.url);
      setImage({ file, url: URL.createObjectURL(file), ...dimensions });
      setCrop({ x: "0", y: "0", width: String(dimensions.width), height: String(dimensions.height) });
      setRotation(0);
      if (inputRef.current && file.name.startsWith("pasted-image-")) inputRef.current.value = "";
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "The image could not be read.");
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function pasteFromClipboard() {
    setMessage("");
    try {
      if (!navigator.clipboard?.read) throw new Error("This browser does not allow direct image clipboard access. Focus the paste area and press Ctrl+V or Command+V instead.");
      const items = await navigator.clipboard.read();
      const item = items.find((candidate) => candidate.types.some((type) => type.startsWith("image/")));
      const type = item?.types.find((candidate) => candidate.startsWith("image/"));
      if (!item || !type) throw new Error("The clipboard does not contain an image.");
      const blob = await item.getType(type);
      await chooseImage(new File([blob], `pasted-image-${Date.now()}.${type.split("/")[1] || "png"}`, { type }));
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "The clipboard image could not be read.");
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    const file = Array.from(event.clipboardData.files).find((candidate) => candidate.type.startsWith("image/"));
    if (!file) {
      setMessage("The clipboard does not contain an image.");
      return;
    }
    event.preventDefault();
    void chooseImage(file.name ? file : new File([file], `pasted-image-${Date.now()}.png`, { type: file.type }));
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const file = Array.from(event.dataTransfer.files).find((candidate) => candidate.type.startsWith("image/"));
    if (!file) {
      setMessage("The dropped item is not a supported image.");
      return;
    }
    void chooseImage(file);
  }

  function fullImage() {
    if (!image) return;
    setCrop({ x: "0", y: "0", width: String(image.width), height: String(image.height) });
    clearResult();
  }

  function updateCrop(key: keyof typeof crop, value: string) {
    setCrop((current) => ({ ...current, [key]: value }));
    clearResult();
  }

  async function getWorker() {
    if (workerRef.current) return workerRef.current;
    setStatus("Loading the local OCR engine");
    const Tesseract = await import("tesseract.js");
    const worker = await Tesseract.createWorker("eng", Tesseract.OEM.LSTM_ONLY, {
      workerPath: "/ocr/worker.min.js",
      corePath: "/ocr/core",
      langPath: "/ocr/lang",
      logger: ({ status: nextStatus, progress: nextProgress }) => {
        setStatus(ocrStatusLabel(nextStatus));
        setProgress(Math.round(Math.max(0, Math.min(1, nextProgress)) * 100));
      },
    });
    workerRef.current = worker;
    await worker.setParameters({ preserve_interword_spaces: "1", user_defined_dpi: "300" });
    return worker;
  }

  async function recognize() {
    if (!image) {
      setMessage("Choose or paste an image first.");
      return;
    }
    setBusy(true);
    setMessage("");
    clearResult();
    try {
      const area = normalizeOcrCrop({
        x: Number(crop.x), y: Number(crop.y), width: Number(crop.width), height: Number(crop.height),
      }, image);
      const prepared = await renderSelection(image, area, rotation);
      const worker = await getWorker();
      const result = await worker.recognize(prepared);
      const recognized = result.data.text.trim();
      setText(recognized);
      setConfidence(Math.round(result.data.confidence));
      setProgress(100);
      setStatus(recognized ? "Recognition complete" : "No text found");
      if (!recognized) setMessage("No readable printed text was found. Try a clearer image or crop closely around the text.");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Text recognition could not finish.");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  async function copyText() {
    if (!(await copyToClipboard(text))) {
      setMessage(COPY_FALLBACK_MESSAGE);
      return;
    }
    setCopied(true);
    setMessage("");
    window.setTimeout(() => setCopied(false), 1800);
  }

  function downloadText() {
    if (!image || !text) return;
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = ocrTextName(image.file.name);
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function reset() {
    selectionIdRef.current += 1;
    if (image?.url) URL.revokeObjectURL(image.url);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setImage(null);
    setPreviewUrl("");
    setCrop({ x: "0", y: "0", width: "", height: "" });
    setRotation(0);
    setMessage("");
    clearResult();
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div>
      <div className="callout-info">
        <strong>Processed locally.</strong> The OCR engine and English model are served by NoTrak. Your image and recognized text stay in this browser.
      </div>

      <label htmlFor="ocr-image" className="mt-6 block text-sm font-semibold">Image containing printed text</label>
      <Input
        ref={inputRef}
        id="ocr-image"
        className="mt-2 h-11 cursor-pointer pt-2"
        type="file"
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        disabled={busy}
        onChange={(event) => void chooseImage(event.target.files?.[0] ?? null)}
      />
      <div
        className="mt-3 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        tabIndex={0}
        onPaste={handlePaste}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        Drop an image here, focus this area and paste, or
        <Button type="button" size="sm" variant="ghost" className="ml-1" disabled={busy} onClick={() => void pasteFromClipboard()}>
          <ClipboardPaste aria-hidden="true" /> Paste from clipboard
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">JPEG, PNG, or WebP up to 15 MB and 40 megapixels. English printed text is supported.</p>

      {image && (
        <section className="mt-7 border-t border-border/70 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Prepare the image</h2>
              <p className="mt-1 break-all text-xs text-muted-foreground">{image.file.name} · {image.width} × {image.height}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => { setRotation(rotateOcrLeft(rotation)); clearResult(); }} aria-label="Rotate left">
                <RotateCcw aria-hidden="true" /> Left
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => { setRotation(rotateOcrRight(rotation)); clearResult(); }} aria-label="Rotate right">
                <RotateCw aria-hidden="true" /> Right
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={fullImage}>Full image</Button>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl bg-muted/40 p-3">
            {/* Blob URLs point only to the visitor's local image selection. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="mx-auto max-h-96 max-w-full rounded-lg object-contain" src={previewUrl || image.url} alt="OCR selection preview" />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {([
              ["x", "Left", image.width - 1],
              ["y", "Top", image.height - 1],
              ["width", "Width", image.width],
              ["height", "Height", image.height],
            ] as const).map(([key, label, max]) => (
              <div key={key}>
                <label htmlFor={`ocr-crop-${key}`} className="text-xs font-semibold">{label} (px)</label>
                <Input
                  id={`ocr-crop-${key}`}
                  className="mt-1"
                  type="number"
                  inputMode="numeric"
                  min={key === "x" || key === "y" ? 0 : 1}
                  max={max}
                  step={1}
                  value={crop[key]}
                  disabled={busy}
                  onChange={(event) => updateCrop(key, event.target.value)}
                />
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Crop closely around the text for faster, more accurate recognition. Rotation: {rotation}°.</p>
        </section>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <Button type="button" className="h-10 px-4" disabled={busy || !image} onClick={() => void recognize()}>
          <ScanText aria-hidden="true" /> {busy ? "Reading locally…" : "Extract text"}
        </Button>
        {image && <Button type="button" className="h-10 px-4" variant="outline" disabled={busy} onClick={reset}><FileImage aria-hidden="true" /> Choose another</Button>}
      </div>

      {(busy || status) && (
        <div className="mt-5" role="status" aria-live="polite">
          <div className="flex items-center justify-between gap-3 text-sm"><span>{status}</span><span className="font-mono text-xs">{progress}%</span></div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-[width]" style={{ width: `${progress}%` }} /></div>
        </div>
      )}

      {text && (
        <section className="result-enter mt-7 border-t border-border/70 pt-6" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label htmlFor="ocr-result" className="font-semibold">Recognized text</label>
            {confidence !== null && <span className="text-xs text-muted-foreground">Engine confidence: {confidence}%</span>}
          </div>
          <Textarea id="ocr-result" className="mt-3 min-h-64 font-mono text-sm" value={text} spellCheck={false} onChange={(event) => { setText(event.target.value); setCopied(false); }} />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => void copyText()}>{copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}{copied ? "Copied" : "Copy text"}</Button>
            <Button type="button" size="sm" variant="outline" onClick={downloadText}><Download aria-hidden="true" /> Download .txt</Button>
            <Button nativeButton={false} size="sm" variant="ghost" render={<Link href="/tools/sensitive-data-redactor" />}>Redact private details</Button>
          </div>
        </section>
      )}

      <p className="mt-4 min-h-5 text-sm text-destructive" role="alert" aria-live="polite">{message}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        OCR can misread characters, columns, handwriting, low-contrast text, or blurry photos. Check important names, numbers, and dates against the original image before using the result.
      </p>
    </div>
  );
}
