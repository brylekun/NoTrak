import { readFileSync } from "node:fs";
import { describe, expect, it, beforeAll } from "vitest";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFArray, PDFDict, PDFHexString, PDFName, type PDFFont } from "pdf-lib";
import { blankEntry, blankResume, MAX_DRAFT_BYTES, moveItem, parseResumeDraft, resumeLink, sampleResume, validateResume } from "../../lib/resume/model";
import { exportResume, layoutResume, type ResumeFonts } from "../../lib/resume/pdf";

const bytes: ResumeFonts = {
  regular: new Uint8Array(readFileSync("public/fonts/resume/NotoSans-Regular.ttf")),
  bold: new Uint8Array(readFileSync("public/fonts/resume/NotoSans-Bold.ttf")),
};
let regular: PDFFont;
let bold: PDFFont;
beforeAll(async () => {
  const pdf = await PDFDocument.create(); pdf.registerFontkit(fontkit);
  regular = await pdf.embedFont(bytes.regular, { features: { liga: false, clig: false } });
  bold = await pdf.embedFont(bytes.bold, { features: { liga: false, clig: false } });
});

describe("resume drafts", () => {
  it("roundtrips a draft with reordered and hidden sections", () => {
    const draft = sampleResume(); draft.sections = moveItem(draft.sections, 0, 1); draft.sections[2].enabled = false;
    expect(parseResumeDraft(JSON.stringify(draft))).toEqual(draft);
    expect(validateResume(blankResume())).toEqual(blankResume());
  });
  it.each(["not json", "null", "{}", '{"format":"notrak-resume","version":2}'])("rejects invalid draft %s", (value) => {
    expect(() => parseResumeDraft(value)).toThrow();
  });
  it("rejects oversized imports and fields", () => {
    expect(() => parseResumeDraft(" ".repeat(MAX_DRAFT_BYTES + 1))).toThrow(/256 KB/);
    const draft = sampleResume(); draft.contact.name = "x".repeat(201);
    expect(() => validateResume(draft)).toThrow(/invalid/);
  });
  it("rejects duplicate IDs, sections, and extra properties", () => {
    const draft = sampleResume(); draft.projects[0].id = draft.experience[0].id;
    expect(() => validateResume(draft)).toThrow();
    const next = sampleResume(); next.sections[0] = next.sections[1];
    expect(() => validateResume(next)).toThrow();
    expect(() => validateResume({ ...sampleResume(), script: "alert(1)" })).toThrow();
  });
  it("bounds entry counts and total text", () => {
    const draft = blankResume(); draft.experience = Array.from({ length: 13 }, blankEntry);
    expect(() => validateResume(draft)).toThrow();
    draft.experience = Array.from({ length: 12 }, () => ({ ...blankEntry(), details: "a".repeat(3000) }));
    draft.summary = "a".repeat(3000); draft.skills = "a".repeat(2000);
    expect(() => validateResume(draft)).toThrow();
  });
  it("moves entries without mutating or crossing boundaries", () => {
    const original = [1, 2, 3]; expect(moveItem(original, 1, -1)).toEqual([2, 1, 3]);
    expect(original).toEqual([1, 2, 3]); expect(moveItem(original, 0, -1)).toEqual(original);
  });
  it("only permits safe absolute web links", () => {
    expect(resumeLink("https://example.com/path")).toBe("https://example.com/path");
    for (const value of ["javascript:alert(1)", "data:text/html,test", "file:///etc/passwd", "https://user:pass@example.com", "//example.com", "example.com"]) expect(resumeLink(value)).toBeUndefined();
  });
});

describe("resume PDF layout", () => {
  it.each(["classic", "compact"] as const)("wraps %s text within real page bounds", (template) => {
    const draft = sampleResume(); draft.template = template;
    draft.summary = "Readable experience and achievements. ".repeat(70);
    draft.experience[0].details = "Detailed accomplishment with clear evidence and useful context. ".repeat(40);
    draft.contact.website = "https://example.com/" + "longpath".repeat(40);
    const layout = layoutResume(draft, regular, bold); const margin = template === "classic" ? 48 : 40;
    expect(layout.pages.length).toBeGreaterThan(1);
    for (const page of layout.pages) {
      expect(page.lines.length).toBeGreaterThan(0);
      for (const line of page.lines) {
        expect(line.x).toBeGreaterThanOrEqual(margin);
        expect(line.x + line.width).toBeLessThanOrEqual(layout.width - margin + 0.01);
        expect(line.y).toBeLessThanOrEqual(layout.height - margin);
        expect(line.y).toBeGreaterThanOrEqual(margin);
      }
      expect(["SUMMARY", "EXPERIENCE", "EDUCATION", "SKILLS", "PROJECTS"]).not.toContain(page.lines.at(-1)?.text);
    }
    expect(layout.pages.flatMap((page) => page.lines).filter((line) => line.text.includes("Readable")).length).toBeGreaterThan(10);
  });
  it("omits blank/hidden sections and respects order", () => {
    const draft = sampleResume(); draft.sections = [...draft.sections].reverse();
    draft.sections.find((s) => s.id === "experience")!.enabled = false;
    draft.skills = "";
    const text = layoutResume(draft, regular, bold).pages.flatMap((page) => page.lines).map((line) => line.text).join("\n");
    expect(text).not.toContain("EXPERIENCE"); expect(text).not.toContain("SKILLS");
    expect(text.indexOf("PROJECTS")).toBeLessThan(text.indexOf("SUMMARY"));
  });
  it("supports accented names and rejects missing glyphs", () => {
    const draft = sampleResume(); draft.contact.name = "José Muñoz — Zoë";
    expect(layoutResume(draft, regular, bold).pages[0].lines[0].text).toBe(draft.contact.name);
    draft.contact.name = "Test 😀";
    expect(() => layoutResume(draft, regular, bold)).toThrow(/not support/);
  });
  it("enforces the page limit", () => {
    const draft = sampleResume(); draft.experience = Array.from({ length: 12 }, () => ({ ...blankEntry(), title: "Work", details: "Accomplishment.\n".repeat(170) }));
    expect(() => layoutResume(draft, regular, bold)).toThrow(/8 pages/);
  });
  it("exports a real PDF with embedded fonts, links, and neutral metadata", async () => {
    const draft = sampleResume(); draft.paper = "letter";
    const buffer = await exportResume(draft, bytes);
    const pdf = await PDFDocument.load(buffer);
    expect(pdf.getTitle()).toBe("Resume"); expect(pdf.getAuthor()).toBe("");
    expect(pdf.getPages()[0].getSize()).toEqual({ width: 612, height: 792 });
    const uris: string[] = [];
    for (const page of pdf.getPages()) {
      const fonts = page.node.Resources()!.lookup(PDFName.of("Font"), PDFDict);
      expect(fonts.keys().length).toBeGreaterThan(0);
      for (const key of fonts.keys()) expect(fonts.lookup(key, PDFDict).has(PDFName.of("ToUnicode"))).toBe(true);
      const annotations = page.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
      for (let i = 0; i < (annotations?.size() ?? 0); i++) {
        const action = annotations!.lookup(i, PDFDict).lookup(PDFName.of("A"), PDFDict);
        uris.push(action.lookup(PDFName.of("URI"), PDFHexString).decodeText());
      }
    }
    expect(uris).toContain("mailto:alex@example.com");
    expect(uris).toContain("https://example.com/portfolio");
    expect(uris).toContain("https://example.com/community");
  });
  it("requires a name for PDF export", async () => {
    await expect(exportResume(blankResume(), bytes)).rejects.toThrow(/full name/);
  });
});
