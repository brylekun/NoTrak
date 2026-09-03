"use client";

import { useEffect, useRef, useState } from "react";
import { Download, ImageOff, RotateCcw, ShieldCheck, TriangleAlert } from "lucide-react";

import { FileDrop } from "@/components/file-drop";
import { Button } from "@/components/ui/button";
import { formatByteSize } from "@/lib/crypto/hash";
import { detectImageMetadata, type MetadataFinding } from "@/lib/images/metadata";
import { outputImageName, type SupportedImageType } from "@/lib/images/process";

const MAX_BATCH_FILES = 20;

type CleanedImage = {
  id: string;
  sourceName: string;
  url: string;
  name: string;
  size: number;
  width: number;
  height: number;
  removed: MetadataFinding[];
};

type FailedImage = {
  id: string;
  sourceName: string;
  reason: string;
};

export function ExifRemover() {
  const [files, setFiles] = useState<File[]>([]);
  const [cleaned, setCleaned] = useState<CleanedImage[]>([]);
  const [failed, setFailed] = useState<FailedImage[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  // Object URLs are revoked on replacement and unmount so a long batch does not
  // hold every export in memory.
  const urlsRef = useRef<string[]>([]);
  useEffect(() => () => {
    for (const url of urlsRef.current) URL.revokeObjectURL(url);
    urlsRef.current = [];
  }, []);

  function releaseUrls() {
    for (const url of urlsRef.current) URL.revokeObjectURL(url);
    urlsRef.current = [];
  }

  function clearResults() {
    releaseUrls();
    setCleaned([]);
    setFailed([]);
    setMessage("");
  }

  function chooseFiles(selected: File[]) {
    clearResults();
    if (selected.length > MAX_BATCH_FILES) {
      setFiles(selected.slice(0, MAX_BATCH_FILES));
      setMessage(`Only the first ${MAX_BATCH_FILES} images were kept. Run the rest in a second batch.`);
      return;
    }
    setFiles(selected);
  }

  async function cleanAll() {
    if (files.length === 0) {
      setMessage("Choose at least one image to clean.");
      return;
    }

    setBusy(true);
    clearResults();

    const imageTools = await import("@/lib/images/process");
    const succeeded: CleanedImage[] = [];
    const errors: FailedImage[] = [];
    const urls: string[] = [];

    for (const [index, file] of files.entries()) {
      const id = `${index}-${file.name}`;
      try {
        imageTools.validateImageFile(file);
        const before = detectImageMetadata(await file.arrayBuffer());
        const outputType = file.type as SupportedImageType;
        const processed = await imageTools.processImage(file, { outputType, quality: 0.95 });
        const after = detectImageMetadata(await processed.blob.arrayBuffer());

        // The ICC profile is a color profile, not identifying metadata, so its
        // presence does not fail verification.
        if (after.some((finding) => finding.container !== "icc")) {
          throw new Error("Metadata verification failed, so this original is unchanged.");
        }

        const url = URL.createObjectURL(processed.blob);
        urls.push(url);
        succeeded.push({
          id,
          sourceName: file.name,
          url,
          name: outputImageName(file.name, "clean", outputType),
          size: processed.blob.size,
          width: processed.width,
          height: processed.height,
          removed: before.filter((finding) => !after.some((entry) => entry.container === finding.container)),
        });
      } catch (reason) {
        errors.push({
          id,
          sourceName: file.name,
          reason: reason instanceof Error ? reason.message : "This image could not be cleaned.",
        });
      }
    }

    urlsRef.current = urls;
    setCleaned(succeeded);
    setFailed(errors);
    setBusy(false);
  }

  function reset() {
    setFiles([]);
    clearResults();
  }

  return (
    <div>
      <FileDrop
        label={files.length > 1 ? `${files.length} images to clean` : "Image to clean"}
        hint={`JPEG, PNG, or WebP up to 25 MB each, ${MAX_BATCH_FILES} at a time. Each clean copy keeps its original dimensions and format.`}
        accept="image/jpeg,image/png,image/webp"
        multiple
        disabled={busy}
        onFiles={chooseFiles}
      />

      {files.length > 0 && (
        <ul className="mt-3 grid gap-1 text-sm text-muted-foreground">
          {files.map((file, index) => (
            <li key={`${index}-${file.name}-${file.lastModified}`} className="truncate">{file.name} · {formatByteSize(file.size)}</li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <Button className="h-10 px-4" onClick={cleanAll} disabled={busy}>
          <ImageOff aria-hidden="true" />
          {busy ? "Cleaning…" : files.length > 1 ? `Remove metadata from ${files.length}` : "Remove metadata"}
        </Button>
        {(files.length > 0 || cleaned.length > 0 || failed.length > 0) && (
          <Button className="h-10 px-4" variant="outline" onClick={reset}><RotateCcw /> Reset</Button>
        )}
      </div>

      {(cleaned.length > 0 || failed.length > 0) && (
        <div className="mt-7 space-y-3" aria-live="polite">
          <p className="text-sm text-muted-foreground" role="status">
            {cleaned.length} of {cleaned.length + failed.length} cleaned.
          </p>

          {cleaned.map((image) => (
            <div key={image.id} className="rounded-2xl border border-primary/20 bg-primary/6 p-5">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary"><ShieldCheck /></span>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{image.sourceName}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {image.removed.length > 0
                      ? "Removed and verified absent from the export:"
                      : "No supported metadata container was found. The image was still re-encoded to avoid carrying supported metadata containers forward."}
                  </p>
                  {image.removed.length > 0 && (
                    <ul className="mt-2 grid gap-1 text-sm text-muted-foreground">
                      {image.removed.map((finding) => <li key={finding.container}>· {finding.label}</li>)}
                    </ul>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {image.width} × {image.height} · {formatByteSize(image.size)}
                  </p>
                </div>
              </div>
              <Button className="mt-4 h-10 px-4" nativeButton={false} render={<a href={image.url} download={image.name} />}>
                <Download aria-hidden="true" /> Download clean copy
              </Button>
            </div>
          ))}

          {failed.map((image) => (
            <div key={image.id} className="callout-warning flex items-start gap-3">
              <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="truncate font-semibold">{image.sourceName}</p>
                <p className="mt-1">{image.reason}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 min-h-5 text-sm text-destructive" role="alert" aria-live="polite">{message}</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        NoTrak checks the JPEG marker segments, PNG chunks, and WebP RIFF chunks that carry metadata. Re-encoding cannot
        remove information visibly captured in the pixels, and it discards the embedded ICC color profile, so colors can
        shift slightly on a wide-gamut display.
      </p>
    </div>
  );
}
