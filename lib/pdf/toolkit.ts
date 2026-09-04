export const MAX_PDF_TOOLKIT_FILES = 10;
export const MAX_PDF_TOOLKIT_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_PDF_TOOLKIT_TOTAL_BYTES = 100 * 1024 * 1024;
export const MAX_PDF_TOOLKIT_PAGES = 100;
export const MAX_PDF_SPLIT_PAGES = 50;

export type PdfToolkitPage = {
  id: string;
  sourceIndex: number;
  sourceName: string;
  sourcePageIndex: number;
  originalPageNumber: number;
  rotation: 0 | 90 | 180 | 270;
};

type PdfFileLike = Pick<File, "name" | "size" | "type">;

export function validatePdfToolkitFiles(files: PdfFileLike[]) {
  if (files.length === 0) throw new Error("Choose at least one PDF document.");
  if (files.length > MAX_PDF_TOOLKIT_FILES) {
    throw new Error(`Choose no more than ${MAX_PDF_TOOLKIT_FILES} PDF documents at once.`);
  }

  let totalBytes = 0;
  for (const file of files) {
    if (file.size === 0) throw new Error(`${file.name || "A selected PDF"} is empty.`);
    if (file.size > MAX_PDF_TOOLKIT_FILE_BYTES) {
      throw new Error(`${file.name || "A selected PDF"} is larger than 50 MB.`);
    }
    if (file.type && file.type !== "application/pdf") {
      throw new Error(`${file.name || "A selected file"} is not a PDF document.`);
    }
    if (!file.type && !file.name.toLowerCase().endsWith(".pdf")) {
      throw new Error(`${file.name || "A selected file"} is not a PDF document.`);
    }
    totalBytes += file.size;
  }

  if (totalBytes > MAX_PDF_TOOLKIT_TOTAL_BYTES) {
    throw new Error("The selected PDFs must total no more than 100 MB.");
  }
}

export function validatePdfSignature(bytes: ArrayBuffer, filename: string) {
  const header = new TextDecoder("latin1").decode(new Uint8Array(bytes, 0, Math.min(1024, bytes.byteLength)));
  if (!header.includes("%PDF-")) throw new Error(`${filename} does not have a valid PDF signature.`);
}

export function normalizePdfRotation(value: number): 0 | 90 | 180 | 270 {
  const normalized = ((value % 360) + 360) % 360;
  if (normalized !== 0 && normalized !== 90 && normalized !== 180 && normalized !== 270) {
    throw new Error("PDF pages can only be rotated in 90-degree steps.");
  }
  return normalized;
}

export function rotatePdfToolkitPage(page: PdfToolkitPage, degrees: 90 | -90): PdfToolkitPage {
  return { ...page, rotation: normalizePdfRotation(page.rotation + degrees) };
}

export function movePdfToolkitPage(pages: PdfToolkitPage[], fromIndex: number, toIndex: number) {
  if (
    !Number.isInteger(fromIndex)
    || !Number.isInteger(toIndex)
    || fromIndex < 0
    || fromIndex >= pages.length
    || toIndex < 0
    || toIndex >= pages.length
  ) return pages;

  const next = [...pages];
  const [page] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, page);
  return next;
}

export async function inspectPdfToolkitSources(buffers: ArrayBuffer[], names: string[]) {
  if (buffers.length !== names.length) throw new Error("The PDF selection could not be read.");
  const { PDFDocument } = await import("pdf-lib");
  const pages: PdfToolkitPage[] = [];

  for (let sourceIndex = 0; sourceIndex < buffers.length; sourceIndex += 1) {
    const source = await PDFDocument.load(buffers[sourceIndex], { updateMetadata: false });
    const pageCount = source.getPageCount();
    if (pageCount === 0) throw new Error(`${names[sourceIndex]} does not contain any pages.`);

    for (let sourcePageIndex = 0; sourcePageIndex < pageCount; sourcePageIndex += 1) {
      pages.push({
        id: `${sourceIndex}-${sourcePageIndex}`,
        sourceIndex,
        sourceName: names[sourceIndex],
        sourcePageIndex,
        originalPageNumber: sourcePageIndex + 1,
        rotation: 0,
      });
    }

    if (pages.length > MAX_PDF_TOOLKIT_PAGES) {
      throw new Error(`Choose PDFs containing no more than ${MAX_PDF_TOOLKIT_PAGES} pages in total.`);
    }
  }

  return pages;
}

async function loadSourceDocuments(buffers: ArrayBuffer[]) {
  const { PDFDocument } = await import("pdf-lib");
  return Promise.all(buffers.map((buffer) => PDFDocument.load(buffer, { updateMetadata: false })));
}

export async function combinePdfToolkitPages(buffers: ArrayBuffer[], pages: PdfToolkitPage[]) {
  if (pages.length === 0) throw new Error("Keep at least one page before creating a PDF.");
  if (pages.length > MAX_PDF_TOOLKIT_PAGES) throw new Error("The output cannot contain more than 100 pages.");

  const { PDFDocument, degrees } = await import("pdf-lib");
  const sources = await loadSourceDocuments(buffers);
  const output = await PDFDocument.create();

  for (const page of pages) {
    const source = sources[page.sourceIndex];
    if (!source || !source.getPage(page.sourcePageIndex)) throw new Error("A selected PDF page is no longer available.");
    const [copied] = await output.copyPages(source, [page.sourcePageIndex]);
    copied.setRotation(degrees(normalizePdfRotation(copied.getRotation().angle + page.rotation)));
    output.addPage(copied);
  }

  return new Uint8Array(await output.save({ addDefaultPage: false, updateFieldAppearances: false })).buffer;
}

export async function splitPdfToolkitPages(buffers: ArrayBuffer[], pages: PdfToolkitPage[]) {
  if (pages.length === 0) throw new Error("Keep at least one page before creating separate PDFs.");
  if (pages.length > MAX_PDF_SPLIT_PAGES) {
    throw new Error(`Separate-page export supports up to ${MAX_PDF_SPLIT_PAGES} selected pages at once.`);
  }

  const { PDFDocument, degrees } = await import("pdf-lib");
  const sources = await loadSourceDocuments(buffers);
  const results: Array<{ buffer: ArrayBuffer; name: string }> = [];

  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    const source = sources[page.sourceIndex];
    if (!source || !source.getPage(page.sourcePageIndex)) throw new Error("A selected PDF page is no longer available.");
    const output = await PDFDocument.create();
    const [copied] = await output.copyPages(source, [page.sourcePageIndex]);
    copied.setRotation(degrees(normalizePdfRotation(copied.getRotation().angle + page.rotation)));
    output.addPage(copied);
    const bytes = await output.save({ addDefaultPage: false, updateFieldAppearances: false });
    results.push({ buffer: new Uint8Array(bytes).buffer, name: splitPdfName(page, index) });
  }

  return results;
}

function safePdfBaseName(filename: string) {
  const base = filename.replace(/\.pdf$/iu, "").trim() || "document";
  return base.replace(/[\\/:*?"<>|]+/gu, "-");
}

export function combinedPdfName(sourceNames: string[]) {
  return sourceNames.length === 1
    ? `${safePdfBaseName(sourceNames[0])}-organized.pdf`
    : "notrak-combined.pdf";
}

export function splitPdfName(page: PdfToolkitPage, outputIndex: number) {
  return `${String(outputIndex + 1).padStart(2, "0")}-${safePdfBaseName(page.sourceName)}-page-${page.originalPageNumber}.pdf`;
}
