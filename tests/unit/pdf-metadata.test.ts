import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";

import { cleanPdfMetadata, cleanedPdfName, inspectPdfMetadata } from "../../lib/pdf/metadata";

describe("PDF metadata cleaner", () => {
  it("removes document information while preserving pages", async () => {
    const document = await PDFDocument.create();
    document.addPage([300, 200]);
    document.setTitle("Private title");
    document.setAuthor("Private author");
    document.setSubject("Private subject");
    document.setCreator("Private creator");
    const source = await document.save({ useObjectStreams: false });

    const sourceBuffer = new Uint8Array(source).buffer;
    const result = await cleanPdfMetadata(sourceBuffer);
    const metadata = await inspectPdfMetadata(result.bytes);
    const reopened = await PDFDocument.load(result.bytes, { updateMetadata: false });

    expect(result.removedFields).toBeGreaterThanOrEqual(4);
    expect(reopened.getPageCount()).toBe(1);
    expect(metadata).toEqual({ hasXmpMetadata: false });
  });

  it("creates a descriptive output filename", () => {
    expect(cleanedPdfName("report.final.PDF")).toBe("report.final-metadata-clean.pdf");
  });
});
