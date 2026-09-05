"use client";

import { useEffect, useRef, useState } from "react";
import { Download, ImageDown, Link2, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatByteSize } from "@/lib/crypto/hash";
import {
  outputImageName,
  processImage,
  readImageDimensions,
  type SupportedImageType,
} from "@/lib/images/process";
import {
  linkedResizeDimensions,
  scaledResizeDimensions,
  validateResizeDimensions,
  type ImageDimensions,
} from "@/lib/images/resize";

type ResizeResult = ImageDimensions & {
  url: string;
  name: string;
  size: number;
};

const OUTPUT_FORMATS: Array<{ value: SupportedImageType; label: string }> = [
  { value: "image/jpeg", label: "JPEG" },
  { value: "image/png", label: "PNG" },
  { value: "image/webp", label: "WebP" },
];

export function ImageResizer() {
  const inputRef = useRef<HTMLInputElement>(null);
  const selectionRef = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<ImageDimensions | null>(null);
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [aspectLocked, setAspectLocked] = useState(true);
  const [outputType, setOutputType] = useState<SupportedImageType>("image/webp");
  const [quality, setQuality] = useState(90);
  const [result, setResult] = useState<ResizeResult | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const url = result?.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [result?.url]);

  function clearResult() {
    setResult(null);
    setMessage("");
  }

  async function chooseFile(selected: File | null) {
    const selection = selectionRef.current + 1;
    selectionRef.current = selection;
    clearResult();
    setFile(null);
    setSource(null);
    setWidth("");
    setHeight("");
    if (!selected) return;

    setBusy(true);
    try {
      const dimensions = await readImageDimensions(selected);
      if (selectionRef.current !== selection) return;
      setFile(selected);
      setSource(dimensions);
      setWidth(String(dimensions.width));
      setHeight(String(dimensions.height));
      setOutputType(selected.type as SupportedImageType);
    } catch (reason) {
      if (selectionRef.current !== selection) return;
      setMessage(reason instanceof Error ? reason.message : "The image could not be read.");
      if (inputRef.current) inputRef.current.value = "";
    } finally {
      if (selectionRef.current === selection) setBusy(false);
    }
  }

  function updateDimension(axis: "width" | "height", rawValue: string) {
    clearResult();
    if (axis === "width") setWidth(rawValue);
    else setHeight(rawValue);
    if (!aspectLocked || !source) return;

    const numericValue = Number(rawValue);
    if (!Number.isFinite(numericValue) || numericValue < 1) return;
    const linked = linkedResizeDimensions(source, axis, numericValue);
    if (axis === "width") setHeight(String(linked.height));
    else setWidth(String(linked.width));
  }

  function applyScalePreset(percentage: number) {
    if (!source) return;
    const dimensions = scaledResizeDimensions(source, percentage);
    setWidth(String(dimensions.width));
    setHeight(String(dimensions.height));
    clearResult();
  }

  async function resize() {
    if (!file || !source) {
      setMessage("Choose an image to resize.");
      return;
    }

    setBusy(true);
    clearResult();
    try {
      const dimensions = validateResizeDimensions(Number(width), Number(height));
      const processed = await processImage(file, {
        outputType,
        quality: quality / 100,
        targetWidth: dimensions.width,
        targetHeight: dimensions.height,
      });
      if (processed.blob.type !== outputType) {
        throw new Error("This browser does not support the selected output format.");
      }
      setResult({
        ...processed,
        url: URL.createObjectURL(processed.blob),
        name: outputImageName(file.name, "resized", outputType),
        size: processed.blob.size,
      });
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "The image could not be resized.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    selectionRef.current += 1;
    setFile(null);
    setSource(null);
    setWidth("");
    setHeight("");
    setAspectLocked(true);
    setOutputType("image/webp");
    setQuality(90);
    setBusy(false);
    clearResult();
    if (inputRef.current) inputRef.current.value = "";
  }

  const targetWidth = Number(width);
  const targetHeight = Number(height);
  const isUpscaling = Boolean(
    source
    && Number.isFinite(targetWidth)
    && Number.isFinite(targetHeight)
    && (targetWidth > source.width || targetHeight > source.height),
  );

  return (
    <div>
      <div className="callout-info">
        <strong>Processed locally.</strong> The image is decoded, resized, and exported in this browser. The original
        file remains unchanged and is never uploaded.
      </div>

      <label htmlFor="resize-image" className="mt-6 block text-sm font-semibold">Image to resize</label>
      <Input
        ref={inputRef}
        id="resize-image"
        className="mt-2 h-11 cursor-pointer pt-2"
        type="file"
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        disabled={busy}
        onChange={(event) => void chooseFile(event.target.files?.[0] ?? null)}
      />
      <p className="mt-2 text-xs text-muted-foreground">JPEG, PNG, or WebP up to 25 MB.</p>

      {file && source && (
        <>
          <p className="mt-3 text-sm font-medium">
            {file.name} · {source.width} × {source.height} · {formatByteSize(file.size)}
          </p>

          <section className="mt-7 border-t border-border/70 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">New dimensions</h2>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={aspectLocked}
                  onChange={(event) => {
                    const locked = event.target.checked;
                    setAspectLocked(locked);
                    if (locked && source && Number(width) > 0) {
                      setHeight(String(linkedResizeDimensions(source, "width", Number(width)).height));
                    }
                    clearResult();
                  }}
                />
                <Link2 className="size-4" aria-hidden="true" /> Keep aspect ratio
              </label>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="resize-width" className="text-sm font-semibold">Width</label>
                <div className="mt-2 flex items-center gap-2">
                  <Input
                    id="resize-width"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={12_000}
                    step={1}
                    value={width}
                    onChange={(event) => updateDimension("width", event.target.value)}
                  />
                  <span className="text-sm text-muted-foreground">px</span>
                </div>
              </div>
              <div>
                <label htmlFor="resize-height" className="text-sm font-semibold">Height</label>
                <div className="mt-2 flex items-center gap-2">
                  <Input
                    id="resize-height"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={12_000}
                    step={1}
                    value={height}
                    onChange={(event) => updateDimension("height", event.target.value)}
                  />
                  <span className="text-sm text-muted-foreground">px</span>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2" aria-label="Resize presets">
              {[25, 50, 75, 100].map((percentage) => (
                <Button key={percentage} type="button" size="sm" variant="outline" onClick={() => applyScalePreset(percentage)}>
                  {percentage}%
                </Button>
              ))}
            </div>

            {isUpscaling && (
              <p className="mt-4 text-sm leading-6 text-amber-700 dark:text-amber-300">
                This is larger than the original. Upscaling adds pixels but cannot recover missing detail.
              </p>
            )}
          </section>

          <section className="mt-7 grid gap-5 border-t border-border/70 pt-6 sm:grid-cols-2">
            <div>
              <label htmlFor="resize-format" className="text-sm font-semibold">Output format</label>
              <select
                id="resize-format"
                className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={outputType}
                onChange={(event) => {
                  setOutputType(event.target.value as SupportedImageType);
                  clearResult();
                }}
              >
                {OUTPUT_FORMATS.map((format) => (
                  <option key={format.value} value={format.value}>{format.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="resize-quality" className="text-sm font-semibold">Quality · {quality}%</label>
              <input
                id="resize-quality"
                className="mt-3 w-full accent-primary"
                type="range"
                min={40}
                max={100}
                value={quality}
                disabled={outputType === "image/png"}
                onChange={(event) => {
                  setQuality(Number(event.target.value));
                  clearResult();
                }}
              />
              <p className="text-xs text-muted-foreground">
                {outputType === "image/png" ? "PNG export is lossless." : "Higher quality usually creates a larger file."}
              </p>
            </div>
          </section>
        </>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <Button type="button" className="h-10 px-4" onClick={resize} disabled={busy || !file}>
          <ImageDown aria-hidden="true" /> {busy ? "Working…" : "Resize image"}
        </Button>
        {(file || result) && (
          <Button type="button" className="h-10 px-4" variant="outline" onClick={reset} disabled={busy}>
            <RotateCcw aria-hidden="true" /> Reset
          </Button>
        )}
      </div>

      {result && (
        <section className="result-enter mt-7 rounded-2xl border border-primary/20 bg-primary/6 p-5" aria-live="polite">
          <h2 className="font-semibold">Resized copy ready</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {result.width} × {result.height} · {formatByteSize(result.size)}
          </p>
          {/* Blob URLs preview only the local browser-generated artifact. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="mt-4 max-h-80 w-full rounded-xl bg-muted/40 object-contain"
            src={result.url}
            alt="Resized preview"
          />
          <Button
            className="mt-4 h-10 px-4"
            nativeButton={false}
            render={<a href={result.url} download={result.name} />}
          >
            <Download aria-hidden="true" /> Download resized copy
          </Button>
        </section>
      )}

      <p className="mt-4 min-h-5 text-sm text-destructive" role="alert" aria-live="polite">{message}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Resizing re-encodes the pixels and removes supported embedded metadata. JPEG does not support transparency,
        so transparent areas become white. Embedded color profiles are not preserved.
      </p>
    </div>
  );
}
