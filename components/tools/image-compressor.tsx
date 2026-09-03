"use client";

import { useEffect, useState } from "react";
import { Download, Images, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { formatByteSize } from "@/lib/crypto/hash";
import { outputImageName, type SupportedImageType } from "@/lib/images/process";

type CompressionResult = {
  url: string;
  name: string;
  size: number;
  width: number;
  height: number;
};

export function ImageCompressor() {
  const [file, setFile] = useState<File | null>(null);
  const [quality, setQuality] = useState(80);
  const [maxDimension, setMaxDimension] = useState(1920);
  const [outputType, setOutputType] = useState<SupportedImageType>("image/webp");
  const [result, setResult] = useState<CompressionResult | null>(null);
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

  async function compress() {
    if (!file) {
      setMessage("Choose an image to compress.");
      return;
    }
    if (!Number.isFinite(maxDimension) || maxDimension < 320 || maxDimension > 8000) {
      setMessage("Maximum dimension must be between 320 and 8,000 pixels.");
      return;
    }

    setBusy(true);
    clearResult();
    try {
      const imageTools = await import("@/lib/images/process");
      const processed = await imageTools.processImage(file, {
        outputType,
        quality: quality / 100,
        maxWidth: maxDimension,
        maxHeight: maxDimension,
      });
      if (processed.blob.type !== outputType) {
        throw new Error("This browser does not support the selected output format.");
      }
      setResult({
        url: URL.createObjectURL(processed.blob),
        name: outputImageName(file.name, "compressed", outputType),
        size: processed.blob.size,
        width: processed.width,
        height: processed.height,
      });
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "The image could not be compressed.");
    } finally {
      setBusy(false);
    }
  }

  const savedPercent = file && result ? Math.round((1 - result.size / file.size) * 100) : 0;

  return (
    <div>
      <label htmlFor="compress-image" className="text-sm font-semibold">Image to compress</label>
      <Input
        id="compress-image"
        className="mt-2 h-11 cursor-pointer pt-2"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => { setFile(event.target.files?.[0] ?? null); clearResult(); }}
      />
      <p className="mt-2 text-xs text-muted-foreground">JPEG, PNG, or WebP up to 25 MB.</p>
      {file && <p className="mt-2 text-sm font-medium">{file.name} · {formatByteSize(file.size)}</p>}

      <div className="mt-7 grid gap-6 sm:grid-cols-2">
        <div>
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="image-quality" className="text-sm font-semibold">Quality</label>
            <span className="rounded-lg bg-muted px-2.5 py-1 font-mono text-sm font-semibold">{quality}%</span>
          </div>
          <Slider
            id="image-quality"
            className="mt-4"
            min={40}
            max={95}
            step={1}
            value={[quality]}
            onValueChange={(value) => {
              const next = Array.isArray(value) ? value[0] : value;
              if (typeof next === "number") { setQuality(next); clearResult(); }
            }}
            aria-label="Output quality"
          />
        </div>
        <div>
          <label htmlFor="image-max-dimension" className="text-sm font-semibold">Maximum width or height</label>
          <Input
            id="image-max-dimension"
            className="mt-2 h-10"
            type="number"
            min={320}
            max={8000}
            step={10}
            value={maxDimension}
            onChange={(event) => { setMaxDimension(Number(event.target.value)); clearResult(); }}
          />
        </div>
      </div>

      <div className="mt-6">
        <label htmlFor="image-output-format" className="text-sm font-semibold">Output format</label>
        <select
          id="image-output-format"
          className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={outputType}
          onChange={(event) => { setOutputType(event.target.value as SupportedImageType); clearResult(); }}
        >
          <option value="image/webp">WebP — usually smallest</option>
          <option value="image/jpeg">JPEG — broad compatibility</option>
          <option value="image/png">PNG — lossless, quality setting ignored</option>
        </select>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button className="h-10 px-4" onClick={compress} disabled={busy}>
          <Images aria-hidden="true" /> {busy ? "Compressing…" : "Compress image"}
        </Button>
        {(file || result) && <Button className="h-10 px-4" variant="outline" onClick={() => { setFile(null); clearResult(); }}><RotateCcw /> Reset</Button>}
      </div>

      {result && file && (
        <div className="mt-7 rounded-2xl border border-primary/20 bg-primary/6 p-5" aria-live="polite">
          <p className="font-semibold">Compressed copy ready</p>
          <div className="mt-3 grid grid-cols-3 gap-3 text-center text-sm">
            <div className="rounded-xl bg-background/70 p-3"><p className="font-semibold">{formatByteSize(file.size)}</p><p className="mt-1 text-xs text-muted-foreground">Original</p></div>
            <div className="rounded-xl bg-background/70 p-3"><p className="font-semibold">{formatByteSize(result.size)}</p><p className="mt-1 text-xs text-muted-foreground">New</p></div>
            <div className="rounded-xl bg-background/70 p-3"><p className={`font-semibold ${savedPercent >= 0 ? "text-primary" : "text-amber-700 dark:text-amber-300"}`}>{savedPercent >= 0 ? `${savedPercent}%` : `${Math.abs(savedPercent)}% larger`}</p><p className="mt-1 text-xs text-muted-foreground">Change</p></div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Output dimensions: {result.width} × {result.height}</p>
          {savedPercent < 0 && <p className="mt-2 text-xs leading-5 text-amber-700 dark:text-amber-300">This export is larger than the original. Try WebP, lower quality, or a smaller dimension.</p>}
          <Button className="mt-4 h-10 px-4" nativeButton={false} render={<a href={result.url} download={result.name} />}>
            <Download aria-hidden="true" /> Download compressed copy
          </Button>
        </div>
      )}

      <p className="mt-4 min-h-5 text-sm text-destructive" role="alert" aria-live="polite">{message}</p>
    </div>
  );
}
