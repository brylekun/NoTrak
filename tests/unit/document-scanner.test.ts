import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";

import {
  createScannedPdf,
  moveScannerPage,
  rotateScannerPage,
  scannerPdfName,
  validateScannerDimensions,
  validateScannerFiles,
} from "../../lib/pdf/document-scanner";

const image = Uint8Array.from(atob("/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/EH//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/EH//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/EH//2Q=="), (character) => character.charCodeAt(0)).buffer;

describe("private document scanner", () => {
  it("validates local image limits and dimensions", () => {
    expect(() => validateScannerFiles([{ name: "page.jpg", size: 100, type: "image/jpeg" }])).not.toThrow();
    expect(() => validateScannerFiles([{ name: "notes.txt", size: 100, type: "text/plain" }])).toThrow(/not a JPEG/);
    expect(() => validateScannerDimensions(2000, 3000)).not.toThrow();
    expect(() => validateScannerDimensions(8000, 8000)).toThrow(/40 megapixels/);
  });

  it("moves and rotates pages without mutating the source", () => {
    const pages = ["one", "two", "three"];
    expect(moveScannerPage(pages, 2, 0)).toEqual(["three", "one", "two"]);
    expect(pages).toEqual(["one", "two", "three"]);
    expect(rotateScannerPage(270)).toBe(0);
  });

  it("creates an A4 PDF with one page per prepared image", async () => {
    const buffer = await createScannedPdf([
      { bytes: image, width: 1, height: 1, ocrText: "PRIVATE SCAN TEST" },
      { bytes: image.slice(0), width: 1, height: 1 },
    ], "a4");
    const pdf = await PDFDocument.load(buffer);
    expect(pdf.getPageCount()).toBe(2);
    expect(pdf.getPage(0).getSize().width).toBeCloseTo(595.28, 1);
    expect(scannerPdfName()).toBe("notrak-scanned-document.pdf");
  });
});
