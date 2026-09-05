import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFHexString, PDFName, rgb, type PDFFont } from "pdf-lib";
import { resumeLink, sectionNames, validateResume, type ResumeDraft } from "./model";

export type ResumeLine = { text: string; x: number; y: number; size: number; width: number; bold: boolean; color: string; href?: string };
export type ResumePage = { lines: ResumeLine[]; rules: number[] };
export type ResumeLayout = { width: number; height: number; pages: ResumePage[] };
export type ResumeFonts = { regular: Uint8Array; bold: Uint8Array };
export const RESUME_FONT_URLS = ["/fonts/resume/NotoSans-Regular.ttf", "/fonts/resume/NotoSans-Bold.ttf"];
let fontRequest: Promise<ResumeFonts> | undefined;

export function loadResumeFonts(): Promise<ResumeFonts> {
  if (!fontRequest) {
    fontRequest = Promise.all(RESUME_FONT_URLS.map(async (url) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error("The resume fonts could not load. Reconnect and try again.");
      return new Uint8Array(await response.arrayBuffer());
    })).then(([regular, bold]) => ({ regular, bold })).catch((error) => { fontRequest = undefined; throw error; });
  }
  return fontRequest;
}

async function makeDocument(fontBytes: ResumeFonts) {
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const regular = await document.embedFont(fontBytes.regular, { subset: true, features: { liga: false, clig: false } });
  const bold = await document.embedFont(fontBytes.bold, { subset: true, features: { liga: false, clig: false } });
  return { document, regular, bold };
}

function normalizeText(text: string) {
  return text.normalize("NFC").replace(/\r\n?/g, "\n").replace(/\t/g, " ").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
}

export function layoutResume(draft: ResumeDraft, regular: PDFFont, bold: PDFFont): ResumeLayout {
  validateResume(draft);
  const width = draft.paper === "a4" ? 595.28 : 612;
  const height = draft.paper === "a4" ? 841.89 : 792;
  const compact = draft.template === "compact";
  const margin = compact ? 40 : 48;
  const body = compact ? 10 : 10.5;
  const lineHeight = compact ? 14 : 15.5;
  const usable = width - margin * 2;
  const ink = "#172b2a";
  const muted = "#435451";
  const accent = compact ? ink : "#176657";
  const supported = new Set(regular.getCharacterSet());
  const pages: ResumePage[] = [{ lines: [], rules: [] }];
  let y = margin;

  function newPage() {
    if (pages.length >= 8) throw new Error("This resume is longer than 8 pages. Shorten the text or hide a section before exporting.");
    pages.push({ lines: [], rules: [] }); y = margin;
  }
  function ensure(space: number) { if (y + space > height - margin) newPage(); }
  function wrap(value: string, size: number, isBold: boolean, maxWidth: number) {
    const text = normalizeText(value);
    for (const char of text) {
      if (char !== "\n" && !supported.has(char.codePointAt(0)!)) {
        throw new Error("The resume font does not support one or more characters. Use Latin, Greek, or Cyrillic text and remove emoji; other scripts are not supported in this version.");
      }
    }
    const font = isBold ? bold : regular;
    const rows: string[] = [];
    for (const paragraph of text.split("\n")) {
      let line = "";
      for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= maxWidth) { line = candidate; continue; }
        if (line) { rows.push(line); line = ""; }
        // Split long URLs and unbroken text so nothing crosses the page margin.
        for (const char of word) {
          if (line && font.widthOfTextAtSize(line + char, size) > maxWidth) { rows.push(line); line = ""; }
          line += char;
        }
      }
      if (line) rows.push(line);
    }
    return rows;
  }
  function text(value: string, options: { size?: number; bold?: boolean; color?: string; indent?: number; href?: string; keep?: number } = {}) {
    if (!value.trim()) return;
    const { size = body, bold: isBold = false, color = ink, indent = 0, href, keep = 0 } = options;
    const rows = wrap(value, size, isBold, usable - indent);
    const step = size > body ? size * 1.35 : lineHeight;
    ensure(Math.min(rows.length, 2) * step + keep);
    for (const row of rows) {
      ensure(step);
      pages.at(-1)!.lines.push({ text: row, x: margin + indent, y: y + size, size, bold: isBold, color, width: (isBold ? bold : regular).widthOfTextAtSize(row, size), href });
      y += step;
    }
  }
  text(draft.contact.name || "Your name", { size: compact ? 23 : 28, bold: true, keep: lineHeight * 2 });
  text(draft.contact.headline, { size: 12, color: muted });
  y += 5;
  text([draft.contact.location, draft.contact.phone].filter((s) => s.trim()).join("  |  "), { color: muted });
  const email = draft.contact.email.trim();
  text(email, { color: muted, href: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? `mailto:${email}` : undefined });
  text(draft.contact.website, { color: muted, href: resumeLink(draft.contact.website) });

  for (const section of draft.sections) {
    if (!section.enabled) continue;
    const value = draft[section.id];
    const entries = Array.isArray(value) ? value.filter((e) => [e.title, e.organization, e.location, e.dates, e.url, e.details].some((v) => v.trim())) : [];
    if (typeof value === "string" ? !value.trim() : entries.length === 0) continue;
    const entryLeadSpace = (entry: typeof entries[number]) => {
      const title = wrap(entry.title, 11, true, usable).length * 11 * 1.35;
      const rest = [entry.organization, entry.location].filter((v) => v.trim()).join(" | ");
      const headers = [rest, entry.dates, entry.url].reduce((sum, v) => sum + wrap(v, body, false, usable).length * lineHeight, 0);
      return Math.max(lineHeight * 3, title + headers + lineHeight * 2);
    };
    const firstSpace = typeof value === "string" ? lineHeight * 2 : entryLeadSpace(entries[0]);
    ensure((compact ? 13 : 19) + 16 + 10 + firstSpace);
    y += compact ? 13 : 19;
    text(sectionNames[section.id].toUpperCase(), { size: 10.5, bold: true, color: accent, keep: lineHeight * 2 });
    pages.at(-1)!.rules.push(y + 2);
    y += 10;
    if (typeof value === "string") { text(value); continue; }
    for (const entry of entries) {
      ensure(entryLeadSpace(entry));
      text(entry.title, { bold: true, size: 11, keep: lineHeight * 2 });
      text([entry.organization, entry.location].filter((v) => v.trim()).join(" | "), { color: muted, keep: lineHeight });
      text(entry.dates, { color: muted, keep: lineHeight });
      text(entry.url, { color: muted, href: resumeLink(entry.url), keep: lineHeight });
      for (const bullet of entry.details.split(/\r?\n/).filter((v) => v.trim())) {
        text(`• ${bullet.trim().replace(/^[-•]\s*/, "")}`, { indent: 8 });
      }
      y += compact ? 7 : 10;
    }
  }
  return { width, height, pages };
}

let measurementFonts: Promise<{ regular: PDFFont; bold: PDFFont }> | undefined;
export async function previewResume(draft: ResumeDraft): Promise<ResumeLayout> {
  if (!measurementFonts) measurementFonts = loadResumeFonts().then(makeDocument).catch((error) => { measurementFonts = undefined; throw error; });
  const fonts = await measurementFonts;
  return layoutResume(draft, fonts.regular, fonts.bold);
}

export async function exportResume(draft: ResumeDraft, bytes?: ResumeFonts) {
  if (!draft.contact.name.trim()) throw new Error("Enter your full name before exporting.");
  const { document, regular, bold } = await makeDocument(bytes ?? await loadResumeFonts());
  const layout = layoutResume(draft, regular, bold);
  for (const content of layout.pages) {
    const page = document.addPage([layout.width, layout.height]);
    const links = [];
    for (const line of content.lines) {
      const channels = line.color.match(/[a-f\d]{2}/gi)!.map((c) => parseInt(c, 16) / 255);
      page.drawText(line.text, { x: line.x, y: layout.height - line.y, size: line.size, font: line.bold ? bold : regular, color: rgb(channels[0], channels[1], channels[2]) });
      if (line.href) {
        links.push(document.context.register(document.context.obj({
          Type: "Annot", Subtype: "Link", Rect: [line.x, layout.height - line.y - 2, line.x + line.width, layout.height - line.y + line.size],
          Border: [0, 0, 0], A: { Type: "Action", S: "URI", URI: PDFHexString.fromText(line.href) },
        })));
      }
    }
    for (const y of content.rules) page.drawLine({ start: { x: draft.template === "compact" ? 40 : 48, y: layout.height - y }, end: { x: layout.width - (draft.template === "compact" ? 40 : 48), y: layout.height - y }, thickness: 0.5, color: rgb(0.7, 0.75, 0.73) });
    if (links.length) page.node.set(PDFName.of("Annots"), document.context.obj(links));
  }
  // Do not copy personal fields into document metadata.
  document.setTitle("Resume"); document.setAuthor(""); document.setCreator("NoTrak");
  return new Uint8Array(await document.save()).buffer;
}
