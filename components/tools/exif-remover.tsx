"use client";

import { useEffect, useState } from "react";
import { Download, ImageOff, RotateCcw, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatByteSize } from "@/lib/crypto/hash";
import { containsExifSegment, outputImageName, type SupportedImageType } from "@/lib/images/process";

type CleanResult = {
  url: string;
  name: string;
  size: number;
  width: number;
  height: number;
  hadExif: boolean;
  exifRemoved: boolean;
};

export function ExifRemover() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<CleanResult | null>(null);
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
      setMessage("Choose an image to clean.");
      return;
    }
    setBusy(true);
    setMessage("");
    clearResult();

    try {
      const imageTools = await import("@/lib/images/process");
      imageTools.validateImageFile(file);
      const hadExif = containsExifSegment(await file.arrayBuffer());
      const outputType = file.type as SupportedImageType;
      const processed = await imageTools.processImage(file, { outputType, quality: 0.95 });
      const exifRemoved = !containsExifSegment(await processed.blob.arrayBuffer());
      if (!exifRemoved) throw new Error("Metadata verification failed. Your original image is unchanged.");

      setResult({
        url: URL.createObjectURL(processed.blob),
        name: outputImageName(file.name, "clean", outputType),
        size: processed.blob.size,
        width: processed.width,
        height: processed.height,
        hadExif,
        exifRemoved,
      });
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "The image could not be cleaned.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setFile(null);
    clearResult();
  }

  return (
    <div>
      <label htmlFor="exif-image" className="text-sm font-semibold">Image to clean</label>
      <Input
        id="exif-image"
        className="mt-2 h-11 cursor-pointer pt-2"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => { setFile(event.target.files?.[0] ?? null); clearResult(); }}
      />
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        JPEG, PNG, or WebP up to 25 MB. The clean copy keeps the original dimensions and format.
      </p>
      {file && <p className="mt-2 text-sm font-medium">{file.name} · {formatByteSize(file.size)}</p>}

      <div className="mt-5 flex flex-wrap gap-2">
        <Button className="h-10 px-4" onClick={clean} disabled={busy}>
          <ImageOff aria-hidden="true" /> {busy ? "Cleaning…" : "Remove metadata"}
        </Button>
        {(file || result) && <Button className="h-10 px-4" variant="outline" onClick={reset}><RotateCcw /> Reset</Button>}
      </div>

      {result && (
        <div className="mt-7 rounded-2xl border border-primary/20 bg-primary/6 p-5" aria-live="polite">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary"><ShieldCheck /></span>
            <div>
              <p className="font-semibold">Clean copy verified</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {result.hadExif ? "An EXIF signature was found in the original and is absent from the export." : "No EXIF signature was found; the image was still re-encoded to discard embedded metadata."}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">{result.width} × {result.height} · {formatByteSize(result.size)}</p>
            </div>
          </div>
          <Button className="mt-4 h-10 px-4" nativeButton={false} render={<a href={result.url} download={result.name} />}>
            <Download aria-hidden="true" /> Download clean copy
          </Button>
        </div>
      )}

      <p className="mt-4 min-h-5 text-sm text-destructive" role="alert" aria-live="polite">{message}</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">Re-encoding removes metadata blocks, but it cannot remove information visibly captured in the pixels.</p>
    </div>
  );
}
