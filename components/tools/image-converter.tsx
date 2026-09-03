"use client";

import { useEffect, useState } from "react";
import { Download, ImageDown, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatByteSize } from "@/lib/crypto/hash";
import { outputImageName, processImage, validateImageFile, type SupportedImageType } from "@/lib/images/process";

type Result = { url: string; name: string; size: number; width: number; height: number };
const FORMATS: Array<{ type: SupportedImageType; label: string }> = [{ type: "image/jpeg", label: "JPEG" }, { type: "image/png", label: "PNG" }, { type: "image/webp", label: "WebP" }];

export function ImageConverter() {
  const [file, setFile] = useState<File | null>(null);
  const [outputType, setOutputType] = useState<SupportedImageType>("image/webp");
  const [quality, setQuality] = useState(88);
  const [result, setResult] = useState<Result | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { const url = result?.url; return () => { if (url) URL.revokeObjectURL(url); }; }, [result?.url]);
  function clear() { setResult(null); setMessage(""); }
  function reset() { setFile(null); clear(); }

  async function convert() {
    if (!file) { setMessage("Choose an image to convert."); return; }
    setBusy(true); clear();
    try {
      validateImageFile(file);
      if (typeof createImageBitmap !== "function") throw new Error("This browser does not support local image decoding.");
      const converted = await processImage(file, { outputType, quality: quality / 100 });
      setResult({ url: URL.createObjectURL(converted.blob), name: outputImageName(file.name, "converted", outputType), size: converted.blob.size, width: converted.width, height: converted.height });
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "The image could not be converted."); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <label htmlFor="convert-image" className="text-sm font-semibold">Image to convert</label><Input id="convert-image" className="mt-2 h-11 cursor-pointer pt-2" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={(event) => { setFile(event.target.files?.[0] ?? null); clear(); }} /><p className="mt-2 text-xs text-muted-foreground">{file ? `${file.name} · ${formatByteSize(file.size)}` : "JPEG, PNG, or WebP up to 25 MB"}</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2"><div><label htmlFor="convert-format" className="text-sm font-semibold">Output format</label><select id="convert-format" className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" value={outputType} onChange={(event) => { setOutputType(event.target.value as SupportedImageType); clear(); }}>{FORMATS.map((format) => <option key={format.type} value={format.type}>{format.label}</option>)}</select></div><div><label htmlFor="convert-quality" className="text-sm font-semibold">Quality · {quality}%</label><input id="convert-quality" className="mt-3 w-full accent-primary" type="range" min="40" max="100" value={quality} disabled={outputType === "image/png"} onChange={(event) => { setQuality(Number(event.target.value)); clear(); }} /><p className="text-xs text-muted-foreground">{outputType === "image/png" ? "PNG uses lossless export." : "Higher quality usually means a larger file."}</p></div></div>
      <div className="mt-5 flex flex-wrap gap-2"><Button className="h-10 px-4" onClick={convert} disabled={busy}><ImageDown />{busy ? "Converting…" : "Convert image"}</Button>{(file || result) && <Button className="h-10 px-4" variant="outline" onClick={reset}><RotateCcw />Reset</Button>}</div>
      {result && (
        <div className="mt-7 rounded-2xl border border-primary/20 bg-primary/6 p-5" aria-live="polite">
          <p className="font-semibold">Converted image ready</p>
          <p className="mt-1 text-sm text-muted-foreground">{result.width} × {result.height} · {formatByteSize(result.size)}</p>
          {/* A blob URL previews the browser-generated local artifact. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="mt-4 max-h-72 w-full rounded-xl bg-[linear-gradient(45deg,#ddd_25%,transparent_25%),linear-gradient(-45deg,#ddd_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#ddd_75%),linear-gradient(-45deg,transparent_75%,#ddd_75%)] bg-[length:18px_18px] object-contain" src={result.url} alt="Converted preview" />
          <Button className="mt-4 h-10 px-4" nativeButton={false} render={<a href={result.url} download={result.name} />}><Download />Download {result.name}</Button>
        </div>
      )}
      <p className="mt-4 min-h-5 text-sm text-destructive" role="alert" aria-live="polite">{message}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">Conversion re-encodes pixels locally. JPEG does not support transparency, so transparent areas become white.</p>
    </div>
  );
}
