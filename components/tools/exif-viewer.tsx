"use client";

import { useState } from "react";
import { AlertTriangle, RotateCcw, ScanEye } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatByteSize } from "@/lib/crypto/hash";
import { parseExifReport, type ExifReport } from "@/lib/images/exif";
import { detectImageMetadata, type MetadataFinding } from "@/lib/images/metadata";

const MAX_EXIF_IMAGE_BYTES = 50 * 1024 * 1024;

type Inspection = {
  report: ExifReport;
  containers: MetadataFinding[];
  name: string;
  size: number;
};

export function ExifViewer() {
  const [file, setFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  function clearResult() {
    setInspection(null);
    setMessage("");
  }

  async function inspect() {
    if (!file) {
      setMessage("Choose an image to inspect.");
      return;
    }
    if (file.size === 0 || file.size > MAX_EXIF_IMAGE_BYTES) {
      setMessage("Choose a non-empty image no larger than 50 MB.");
      return;
    }

    setBusy(true);
    clearResult();
    try {
      const bytes = await file.arrayBuffer();
      const containers = detectImageMetadata(bytes);

      setInspection({
        report: await parseExifReport(bytes),
        containers,
        name: file.name,
        size: file.size,
      });
    } catch {
      setMessage("This image could not be read. It may be damaged or in an unsupported format.");
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
      <div className="callout-info">
        The image is read in your browser and never uploaded. Coordinates are shown as plain text and are not sent to a
        map service, because that would hand your location to a third party.
      </div>

      <label htmlFor="exif-view-image" className="mt-6 block text-sm font-semibold">Image to inspect</label>
      <Input
        id="exif-view-image"
        className="mt-2 h-11 cursor-pointer pt-2"
        type="file"
        accept="image/*"
        onChange={(event) => { setFile(event.target.files?.[0] ?? null); clearResult(); }}
      />
      <p className="mt-2 text-xs leading-5 text-muted-foreground">Up to 50 MB. JPEG, PNG, WebP, HEIC, TIFF, and AVIF metadata can usually be read.</p>
      {file && <p className="mt-2 text-sm font-medium">{file.name} · {formatByteSize(file.size)}</p>}

      <div className="mt-5 flex flex-wrap gap-2">
        <Button className="h-10 px-4" onClick={inspect} disabled={busy}>
          <ScanEye aria-hidden="true" /> {busy ? "Reading…" : "Read metadata"}
        </Button>
        {(file || inspection) && <Button className="h-10 px-4" variant="outline" onClick={reset}><RotateCcw /> Reset</Button>}
      </div>

      {inspection && (
        <div className="mt-7 space-y-5 border-t border-border/70 pt-6" aria-live="polite">
          {inspection.report.hasLocation && (
            <div className="callout-warning flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-semibold">This image records where it was taken.</p>
                <p className="mt-1">
                  Anyone you send the original to can read these coordinates. Use the EXIF Remover to produce a clean
                  copy before sharing it.
                </p>
              </div>
            </div>
          )}

          <div>
            <p className="text-sm text-muted-foreground">Metadata found</p>
            <p className="text-2xl font-semibold">
              {inspection.report.fieldCount === 0
                ? "No readable metadata"
                : `${inspection.report.fieldCount} ${inspection.report.fieldCount === 1 ? "field" : "fields"}`}
            </p>
            {inspection.containers.length > 0 && (
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Containers present: {inspection.containers.map((finding) => finding.label).join("; ")}.
              </p>
            )}
          </div>

          {inspection.report.groups.map((group) => (
            <section key={group.id}>
              <h2 className="text-sm font-semibold">
                {group.title}
                {group.sensitive && <span className="ml-2 surface-exposed">Sensitive</span>}
              </h2>
              <dl className="mt-2 divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/70">
                {group.fields.map((field) => (
                  <div key={`${group.id}-${field.label}`} className="grid gap-1 px-4 py-3 sm:grid-cols-[13rem_1fr] sm:gap-4">
                    <dt className="text-sm font-semibold">{field.label}</dt>
                    <dd className="break-words font-mono text-sm text-muted-foreground">{field.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}

          {inspection.report.fieldCount === 0 && (
            <p className="text-sm leading-6 text-muted-foreground">
              No EXIF, GPS, or descriptive metadata could be read. Some apps and messaging services strip metadata before
              you receive a file, and a screenshot usually never had any.
            </p>
          )}
        </div>
      )}

      <p className="mt-4 min-h-5 text-sm text-destructive" role="alert" aria-live="polite">{message}</p>
    </div>
  );
}
