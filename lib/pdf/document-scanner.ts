import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export const MAX_SCANNER_IMAGES = 12;
export const MAX_SCANNER_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_SCANNER_TOTAL_BYTES = 60 * 1024 * 1024;
export const MAX_SCANNER_IMAGE_PIXELS = 40_000_000;

export type ScannerPageSize = "a4" | "letter";
export type ScannerEnhancement = "original" | "grayscale" | "document";
export type ScannerRotation = 0 | 90 | 180 | 270;

export type ScannerPdfPage = {
  bytes: ArrayBuffer;
  width: number;
  height: number;
  ocrText?: string;
};

const SUPPORTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const PAGE_SIZES: Record<ScannerPageSize, readonly [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
};

export function validateScannerFiles(files: Array<Pick<File, "name" | "size" | "type">>) {
  if (files.length === 0) throw new Error("Choose at least one image.");
  if (files.length > MAX_SCANNER_IMAGES) throw new Error(`Choose no more than ${MAX_SCANNER_IMAGES} images at once.`);
  let total = 0;
  for (const file of files) {
    if (!SUPPORTED_TYPES.has(file.type)) throw new Error(`${file.name || "A selected file"} is not a JPEG, PNG, or WebP image.`);
    if (file.size === 0) throw new Error(`${file.name || "A selected image"} is empty.`);
    if (file.size > MAX_SCANNER_IMAGE_BYTES) throw new Error(`${file.name || "A selected image"} is larger than 15 MB.`);
    total += file.size;
  }
  if (total > MAX_SCANNER_TOTAL_BYTES) throw new Error("Choose images totaling no more than 60 MB.");
}

export function validateScannerDimensions(width: number, height: number) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error("An image's dimensions could not be read.");
  }
  if (width * height > MAX_SCANNER_IMAGE_PIXELS) throw new Error("Choose images with no more than 40 megapixels each.");
}

export function rotateScannerPage(rotation: ScannerRotation): ScannerRotation {
  return ((rotation + 90) % 360) as ScannerRotation;
}

export function moveScannerPage<T>(pages: readonly T[], from: number, to: number) {
  if (from === to || from < 0 || to < 0 || from >= pages.length || to >= pages.length) return [...pages];
  const next = [...pages];
  const [page] = next.splice(from, 1);
  next.splice(to, 0, page);
  return next;
}

export function scannerPdfName() {
  return "notrak-scanned-document.pdf";
}

function searchableText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\x20-\x7E\n]/gu, "")
    .replace(/[\t\r]+/gu, " ")
    .trim();
}

export async function createScannedPdf(pages: ScannerPdfPage[], pageSize: ScannerPageSize) {
  if (pages.length === 0) throw new Error("Add at least one page before creating a PDF.");
  const document = await PDFDocument.create();
  document.setTitle("");
  document.setAuthor("");
  document.setSubject("");
  document.setKeywords([]);
  document.setProducer("NoTrak Private Document Scanner");
  document.setCreator("NoTrak Private Document Scanner");
  const font = await document.embedFont(StandardFonts.Helvetica);
  const [pageWidth, pageHeight] = PAGE_SIZES[pageSize];
  const margin = 24;

  for (const source of pages) {
    const page = document.addPage([pageWidth, pageHeight]);
    const image = await document.embedJpg(source.bytes);
    const scale = Math.min((pageWidth - margin * 2) / source.width, (pageHeight - margin * 2) / source.height);
    const width = source.width * scale;
    const height = source.height * scale;
    page.drawImage(image, {
      x: (pageWidth - width) / 2,
      y: (pageHeight - height) / 2,
      width,
      height,
    });

    const text = searchableText(source.ocrText ?? "");
    if (text) {
      const lines = text.split(/\n+/u).flatMap((line) => line.match(/.{1,90}(?:\s|$)/gu) ?? [line]).slice(0, 180);
      lines.forEach((line, index) => {
        page.drawText(line.trim(), {
          x: margin,
          y: Math.max(margin, pageHeight - margin - 7 - index * 7),
          size: 6,
          font,
          color: rgb(0, 0, 0),
          opacity: 0,
        });
      });
    }
  }

  const bytes = await document.save({ useObjectStreams: false });
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
