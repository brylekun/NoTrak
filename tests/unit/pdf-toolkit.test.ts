import { describe, expect, it } from "vitest";
import { degrees, PDFDocument } from "pdf-lib";

import {
  combinePdfToolkitPages,
  combinedPdfName,
  inspectPdfToolkitSources,
  movePdfToolkitPage,
  normalizePdfRotation,
  rotatePdfToolkitPage,
  splitPdfToolkitPages,
  validatePdfSignature,
  validatePdfToolkitFiles,
  type PdfToolkitPage,
} from "../../lib/pdf/toolkit";

async function makePdf(pages: Array<{ width: number; height: number; rotation?: number }>) {
  const document = await PDFDocument.create();
  for (const page of pages) {
    const added = document.addPage([page.width, page.height]);
    if (page.rotation) added.setRotation(degrees(page.rotation));
  }
  return new Uint8Array(await document.save()).buffer;
}

describe("PDF toolkit", () => {
  it("validates file limits and PDF signatures", async () => {
    const source = await makePdf([{ width: 200, height: 300 }]);
    expect(() => validatePdfToolkitFiles([{ name: "report.pdf", size: source.byteLength, type: "application/pdf" }])).not.toThrow();
    expect(() => validatePdfSignature(source, "report.pdf")).not.toThrow();
    expect(() => validatePdfSignature(new TextEncoder().encode("not a pdf").buffer, "notes.pdf")).toThrow(/valid PDF signature/);
    expect(() => validatePdfToolkitFiles([{ name: "photo.png", size: 10, type: "image/png" }])).toThrow(/not a PDF/);
  });

  it("creates one page-plan entry for every source page", async () => {
    const pages = await inspectPdfToolkitSources(
      [await makePdf([{ width: 100, height: 200 }, { width: 200, height: 300 }]), await makePdf([{ width: 400, height: 500 }])],
      ["first.pdf", "second.pdf"],
    );

    expect(pages).toEqual([
      expect.objectContaining({ id: "0-0", sourceName: "first.pdf", originalPageNumber: 1, rotation: 0 }),
      expect.objectContaining({ id: "0-1", sourceName: "first.pdf", originalPageNumber: 2, rotation: 0 }),
      expect.objectContaining({ id: "1-0", sourceName: "second.pdf", originalPageNumber: 1, rotation: 0 }),
    ]);
  });

  it("moves and rotates planned pages without changing the input", () => {
    const pages = [
      { id: "a", sourceIndex: 0, sourceName: "a.pdf", sourcePageIndex: 0, originalPageNumber: 1, rotation: 0 as const },
      { id: "b", sourceIndex: 0, sourceName: "a.pdf", sourcePageIndex: 1, originalPageNumber: 2, rotation: 0 as const },
    ];

    expect(movePdfToolkitPage(pages, 1, 0).map((page) => page.id)).toEqual(["b", "a"]);
    expect(pages.map((page) => page.id)).toEqual(["a", "b"]);
    expect(rotatePdfToolkitPage(pages[0], 90).rotation).toBe(90);
    expect(rotatePdfToolkitPage({ ...pages[0], rotation: 0 }, -90).rotation).toBe(270);
    expect(normalizePdfRotation(450)).toBe(90);
  });

  it("combines selected pages in their planned order and applies relative rotation", async () => {
    const sources = [
      await makePdf([{ width: 100, height: 200 }, { width: 210, height: 310 }]),
      await makePdf([{ width: 400, height: 500, rotation: 90 }]),
    ];
    const plan: PdfToolkitPage[] = [
      { id: "1-0", sourceIndex: 1, sourceName: "second.pdf", sourcePageIndex: 0, originalPageNumber: 1, rotation: 90 },
      { id: "0-1", sourceIndex: 0, sourceName: "first.pdf", sourcePageIndex: 1, originalPageNumber: 2, rotation: 0 },
    ];

    const output = await PDFDocument.load(await combinePdfToolkitPages(sources, plan));
    expect(output.getPageCount()).toBe(2);
    expect(output.getPage(0).getSize()).toEqual({ width: 400, height: 500 });
    expect(output.getPage(0).getRotation().angle).toBe(180);
    expect(output.getPage(1).getSize()).toEqual({ width: 210, height: 310 });
  });

  it("creates one valid one-page PDF for every selected page", async () => {
    const source = await makePdf([{ width: 100, height: 200 }, { width: 200, height: 300 }]);
    const plan = await inspectPdfToolkitSources([source], ["report.final.pdf"]);
    const outputs = await splitPdfToolkitPages([source], plan);

    expect(outputs.map((output) => output.name)).toEqual([
      "01-report.final-page-1.pdf",
      "02-report.final-page-2.pdf",
    ]);
    for (const output of outputs) {
      const reopened = await PDFDocument.load(output.buffer);
      expect(reopened.getPageCount()).toBe(1);
    }
  });

  it("creates descriptive combined filenames", () => {
    expect(combinedPdfName(["report.final.PDF"])).toBe("report.final-organized.pdf");
    expect(combinedPdfName(["one.pdf", "two.pdf"])).toBe("notrak-combined.pdf");
  });
});
