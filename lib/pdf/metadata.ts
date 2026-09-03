export const MAX_PDF_BYTES = 50 * 1024 * 1024;

export type PdfMetadataSummary = {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  creationDate?: string;
  modificationDate?: string;
  hasXmpMetadata: boolean;
};

const INFO_KEYS = ["Title", "Author", "Subject", "Keywords", "Creator", "Producer", "CreationDate", "ModDate", "Trapped"];

export function validatePdfFile(file: Pick<File, "size" | "type" | "name">, signature?: Uint8Array) {
  if (file.size === 0) throw new Error("The selected PDF is empty.");
  if (file.size > MAX_PDF_BYTES) throw new Error("Choose a PDF no larger than 50 MB.");
  if (file.type && file.type !== "application/pdf") throw new Error("Choose a PDF document.");
  if (signature && new TextDecoder().decode(signature.slice(0, 5)) !== "%PDF-") {
    throw new Error("The selected file does not have a valid PDF signature.");
  }
}

export function cleanedPdfName(filename: string) {
  const base = filename.replace(/\.pdf$/iu, "") || "document";
  return `${base}-metadata-clean.pdf`;
}

function dateToIso(value: Date | undefined) {
  return value && !Number.isNaN(value.getTime()) ? value.toISOString() : undefined;
}

export async function inspectPdfMetadata(bytes: ArrayBuffer): Promise<PdfMetadataSummary> {
  const { PDFDocument, PDFName } = await import("pdf-lib");
  const document = await PDFDocument.load(bytes, { updateMetadata: false });
  return {
    title: document.getTitle(),
    author: document.getAuthor(),
    subject: document.getSubject(),
    keywords: document.getKeywords(),
    creator: document.getCreator(),
    producer: document.getProducer(),
    creationDate: dateToIso(document.getCreationDate()),
    modificationDate: dateToIso(document.getModificationDate()),
    hasXmpMetadata: document.catalog.has(PDFName.of("Metadata")),
  };
}

export async function cleanPdfMetadata(bytes: ArrayBuffer) {
  const { PDFDict, PDFDocument, PDFName } = await import("pdf-lib");
  const document = await PDFDocument.load(bytes, { updateMetadata: false });
  const before = await inspectLoadedDocument(document, PDFName);
  const infoRef = document.context.trailerInfo.Info;

  if (infoRef) {
    const info = document.context.lookup(infoRef, PDFDict);
    for (const key of INFO_KEYS) info.delete(PDFName.of(key));
  }
  document.catalog.delete(PDFName.of("Metadata"));

  const cleaned = await document.save({ addDefaultPage: false, updateFieldAppearances: false });
  const output = new Uint8Array(cleaned).buffer;
  const after = await inspectPdfMetadata(output);
  const remaining = Object.entries(after).filter(([key, value]) => key === "hasXmpMetadata" ? value : Boolean(value));
  if (remaining.length > 0) throw new Error("Metadata verification failed. The original PDF is unchanged.");

  const removedFields = Object.entries(before).filter(([key, value]) => key === "hasXmpMetadata" ? value : Boolean(value)).length;
  return {
    bytes: output,
    pageCount: document.getPageCount(),
    removedFields,
    before,
    after,
  };
}

async function inspectLoadedDocument(
  document: Awaited<ReturnType<(typeof import("pdf-lib"))["PDFDocument"]["load"]>>,
  PDFName: (typeof import("pdf-lib"))["PDFName"],
): Promise<PdfMetadataSummary> {
  return {
    title: document.getTitle(),
    author: document.getAuthor(),
    subject: document.getSubject(),
    keywords: document.getKeywords(),
    creator: document.getCreator(),
    producer: document.getProducer(),
    creationDate: dateToIso(document.getCreationDate()),
    modificationDate: dateToIso(document.getModificationDate()),
    hasXmpMetadata: document.catalog.has(PDFName.of("Metadata")),
  };
}
