"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Download, FileUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { blankEntry, blankResume, MAX_DRAFT_BYTES, MAX_ENTRIES, moveItem, parseResumeDraft, sampleResume, sectionNames, type EntrySection, type ResumeDraft, type ResumeEntry } from "@/lib/resume/model";
import type { ResumeLayout } from "@/lib/resume/pdf";
import "./resume-builder.css";

const selectClass = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm";

function Field({ label, value, onChange, multiline = false, maxLength = 200, placeholder }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean; maxLength?: number; placeholder?: string }) {
  const id = useId();
  const props = { id, value, maxLength, placeholder, autoComplete: "off", onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value) };
  return <div className="min-w-0 space-y-2"><label htmlFor={id} className="text-sm font-medium">{label}</label>{multiline ? <Textarea {...props} rows={4} /> : <Input {...props} />}</div>;
}

function Reorder({ label, index, count, onMove }: { label: string; index: number; count: number; onMove: (direction: -1 | 1) => void }) {
  return <div className="flex shrink-0 gap-1">
    <Button type="button" size="icon" variant="outline" aria-label={`Move ${label} up`} disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp className="size-4" /></Button>
    <Button type="button" size="icon" variant="outline" aria-label={`Move ${label} down`} disabled={index === count - 1} onClick={() => onMove(1)}><ArrowDown className="size-4" /></Button>
  </div>;
}

export function ResumeBuilder() {
  const [draft, setDraft] = useState<ResumeDraft>(blankResume);
  const [saved, setSaved] = useState(() => JSON.stringify(blankResume()));
  const [preview, setPreview] = useState<{ draft: ResumeDraft; layout: ResumeLayout }>();
  const [previewError, setPreviewError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);
  const downloadUrls = useRef(new Set<string>());
  const dirty = saved !== JSON.stringify(draft);
  const ready = preview?.draft === draft && !previewError;

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const { previewResume } = await import("@/lib/resume/pdf");
        const layout = await previewResume(draft);
        if (!cancelled) { setPreview({ draft, layout }); setPreviewError(""); }
      } catch {
        // Do not surface library errors, which can contain the user's input.
        if (!cancelled) setPreviewError("Preview unavailable. Check the text and length: use Latin, Greek, or Cyrillic characters without emoji, and keep the resume within 8 pages and 40,000 characters. If the text is supported, reconnect and reload your saved draft.");
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [draft]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const warnOnLink = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a") : null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const target = new URL(anchor.href, window.location.href);
      if (target.origin === window.location.origin && target.pathname === window.location.pathname && target.search === window.location.search) return;
      if (!window.confirm("Leave the resume builder? Download a draft first to keep your unsaved edits.")) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", warnOnLink, true);
    return () => { window.removeEventListener("beforeunload", warn); document.removeEventListener("click", warnOnLink, true); };
  }, [dirty]);

  useEffect(() => {
    const urls = downloadUrls.current;
    return () => { urls.forEach((url) => URL.revokeObjectURL(url)); urls.clear(); };
  }, []);

  function update(next: ResumeDraft) {
    if (JSON.stringify(next).length > 40000) { setMessage("The draft has reached its 40,000-character limit. Shorten an entry before adding more text."); return; }
    setDraft(next); setMessage("");
  }
  function download(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    downloadUrls.current.add(url);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = name; anchor.click();
    setTimeout(() => { URL.revokeObjectURL(url); downloadUrls.current.delete(url); }, 60_000);
  }
  function replace(next: ResumeDraft) {
    if (dirty && !window.confirm("Replace your current resume? Download a draft first if you want to keep it.")) return;
    update(next);
  }
  function saveDraft() {
    const json = JSON.stringify(draft);
    download(new Blob([json], { type: "application/json" }), "notrak-resume-draft.json");
    setSaved(json); setMessage("Draft download started. Keep the file somewhere private; it contains your personal details.");
  }
  async function openDraft(file?: File) {
    if (!file) return;
    if (dirty && !window.confirm("Replace your current resume with this draft? Unsaved edits will be lost.")) return;
    setBusy(true);
    try {
      if (file.size > MAX_DRAFT_BYTES) throw new Error("Draft too large");
      const next = parseResumeDraft(await file.text());
      update(next); setSaved(JSON.stringify(next)); setMessage("Local draft opened. No file was uploaded.");
    } catch { setMessage("Could not open this draft. Choose a valid NoTrak resume JSON file under 256 KB. Your current resume was kept."); }
    finally { setBusy(false); }
  }
  async function exportPdf() {
    setBusy(true); setMessage("");
    try {
      const { exportResume } = await import("@/lib/resume/pdf");
      const buffer = await exportResume(draft);
      download(new Blob([buffer], { type: "application/pdf" }), "resume.pdf");
      setMessage("PDF download started. Review the downloaded pages before sharing. Save a draft too if you want to edit later.");
    } catch { setMessage("Could not export the resume. Check the preview, supported characters, and page limit, then try again. Your edits are still here."); }
    finally { setBusy(false); }
  }
  function changeEntry(section: EntrySection, id: string, key: keyof ResumeEntry, value: string) {
    update({ ...draft, [section]: draft[section].map((entry) => entry.id === id ? { ...entry, [key]: value } : entry) });
  }

  return <div className="space-y-6">
    <div className="callout-info text-sm leading-6">Your resume stays in this tab. Nothing is autosaved: download a draft before leaving. Draft files are unencrypted. The PDF has selectable text and no watermark.</div>
    <fieldset disabled={busy} className="min-w-0 space-y-6">
      <legend className="sr-only">Resume editor</legend>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={!ready || !draft.contact.name.trim()} onClick={exportPdf}><Download className="size-4" />{busy ? "Preparing…" : "Download PDF"}</Button>
        <Button type="button" variant="outline" onClick={saveDraft}>Save draft</Button>
        <Button type="button" variant="outline" onClick={() => importInput.current?.click()}><FileUp className="size-4" />Open draft</Button>
        <input ref={importInput} aria-label="Open resume draft file" type="file" accept=".json,application/json" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; void openDraft(file); }} />
        <Button type="button" variant="outline" onClick={() => replace(sampleResume())}>Load fictional example</Button>
        <Button type="button" variant="ghost" onClick={() => replace(blankResume())}>Clear all</Button>
      </div>
      <p role="status" className="text-sm leading-6 text-muted-foreground">{message || (dirty ? "Unsaved edits — save a local draft to keep them." : "No automatic storage or account required.")}</p>
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="min-w-0 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <label className="space-y-2 text-sm font-medium"><span>Template</span><select aria-label="Template" className={selectClass} value={draft.template} onChange={(e) => update({ ...draft, template: e.target.value as ResumeDraft["template"] })}><option value="classic">Classic</option><option value="compact">Compact</option></select></label>
            <label className="space-y-2 text-sm font-medium"><span>Paper size</span><select aria-label="Paper size" className={selectClass} value={draft.paper} onChange={(e) => update({ ...draft, paper: e.target.value as ResumeDraft["paper"] })}><option value="a4">A4</option><option value="letter">US Letter</option></select></label>
          </div>
          <section className="space-y-4" aria-labelledby="resume-contact-heading">
            <h2 id="resume-contact-heading" className="text-xl font-semibold">Contact details</h2>
            <Field label="Full name (required for PDF)" value={draft.contact.name} onChange={(name) => update({ ...draft, contact: { ...draft.contact, name } })} />
            {([ ["headline", "Professional headline"], ["email", "Email"], ["phone", "Phone"], ["location", "Location"], ["website", "Website or LinkedIn URL"] ] as const).map(([key, label]) => <Field key={key} label={label} value={draft.contact[key]} maxLength={key === "website" ? 400 : 200} onChange={(value) => update({ ...draft, contact: { ...draft.contact, [key]: value } })} />)}
            <p className="text-xs leading-5 text-muted-foreground">Only include details you want to share. Use a full https:// address for clickable website links.</p>
          </section>
          {draft.sections.map((section, index) => <section key={section.id} className="space-y-4 rounded-2xl border border-border p-4" aria-label={`${sectionNames[section.id]} section`}>
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={section.enabled} onChange={(e) => update({ ...draft, sections: draft.sections.map((s) => s.id === section.id ? { ...s, enabled: e.target.checked } : s) })} />{sectionNames[section.id]}</label>
              <Reorder label={`${sectionNames[section.id]} section`} index={index} count={draft.sections.length} onMove={(direction) => update({ ...draft, sections: moveItem(draft.sections, index, direction) })} />
            </div>
            {!section.enabled ? <p className="text-sm text-muted-foreground">Hidden from the PDF. Your entries are kept in the draft.</p> : section.id === "summary" || section.id === "skills" ? <Field label={section.id === "summary" ? "Professional summary" : "Skills (comma-separated or one per line)"} multiline maxLength={section.id === "summary" ? 3000 : 2000} value={draft[section.id]} onChange={(value) => update({ ...draft, [section.id]: value })} /> : <>
              {draft[section.id].map((entry, entryIndex) => {
                const entrySection = section.id as EntrySection;
                const label = `${sectionNames[entrySection]} ${entryIndex + 1}`;
                return <fieldset key={entry.id} className="min-w-0 space-y-3 border-t border-border pt-3">
                  <legend className="text-sm font-medium">{label}</legend>
                  <div className="flex flex-wrap justify-between gap-2"><Reorder label={label} index={entryIndex} count={draft[entrySection].length} onMove={(direction) => update({ ...draft, [entrySection]: moveItem(draft[entrySection], entryIndex, direction) })} /><Button type="button" variant="ghost" aria-label={`Remove ${label}`} onClick={() => { if (Object.entries(entry).some(([key, value]) => key !== "id" && value.trim()) && !window.confirm("Remove this entry? This cannot be undone.")) return; update({ ...draft, [entrySection]: draft[entrySection].filter((e) => e.id !== entry.id) }); }}><Trash2 className="size-4" />Remove</Button></div>
                  <Field label={entrySection === "experience" ? "Job title" : entrySection === "education" ? "Degree or qualification" : "Project name"} value={entry.title} onChange={(v) => changeEntry(entrySection, entry.id, "title", v)} />
                  <Field label={entrySection === "education" ? "School" : "Organization"} value={entry.organization} onChange={(v) => changeEntry(entrySection, entry.id, "organization", v)} />
                  <Field label="Location" value={entry.location} onChange={(v) => changeEntry(entrySection, entry.id, "location", v)} />
                  <Field label="Dates" placeholder="Jan 2023 – Present" value={entry.dates} onChange={(v) => changeEntry(entrySection, entry.id, "dates", v)} />
                  <Field label="Link (optional)" maxLength={400} value={entry.url} onChange={(v) => changeEntry(entrySection, entry.id, "url", v)} />
                  <Field label="Highlights (one bullet per line)" multiline maxLength={3000} value={entry.details} onChange={(v) => changeEntry(entrySection, entry.id, "details", v)} />
                </fieldset>;
              })}
              <Button type="button" variant="outline" disabled={draft[section.id].length >= MAX_ENTRIES} onClick={() => { const key = section.id as EntrySection; update({ ...draft, [key]: [...draft[key], blankEntry()] }); }}><Plus className="size-4" />Add {sectionNames[section.id].toLowerCase()}</Button>
            </>}
          </section>)}
        </div>
        <section aria-label="Resume preview" className="min-w-0 space-y-4 lg:sticky lg:top-6">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-semibold">Live preview</h2><span className="text-sm text-muted-foreground" role="status">{previewError ? "Check your resume" : ready ? `${preview.layout.pages.length} ${preview.layout.pages.length === 1 ? "page" : "pages"}` : "Updating preview…"}</span></div>
          <p className="text-xs leading-5 text-muted-foreground">Both templates are single-column. Blank sections are omitted. Review page breaks before exporting; compatibility with every hiring system is not guaranteed.</p>
          {previewError && <p role="alert" className="callout-warning text-sm leading-6">{previewError}</p>}
          <div className="space-y-4 rounded-xl bg-muted/40 p-2 lg:max-h-[80vh] lg:overflow-y-auto" aria-busy={!ready}>
            {preview && !previewError && preview.layout.pages.map((page, index) => <svg key={index} role="img" aria-label={`Resume preview page ${index + 1}`} viewBox={`0 0 ${preview.layout.width} ${preview.layout.height}`} className={`block w-full bg-white shadow-sm ${ready ? "" : "opacity-50"}`}>
              <title>Resume preview page {index + 1}</title>
              {page.rules.map((y, i) => <line key={`rule-${i}`} x1={preview.draft.template === "compact" ? 40 : 48} x2={preview.layout.width - (preview.draft.template === "compact" ? 40 : 48)} y1={y} y2={y} stroke="#b3bfba" strokeWidth="0.5" />)}
              {page.lines.map((line, i) => <text key={i} x={line.x} y={line.y} fontSize={line.size} fontFamily="NoTrak Resume" fontWeight={line.bold ? 700 : 400} fill={line.color} textLength={line.width} lengthAdjust="spacingAndGlyphs">{line.text}</text>)}
            </svg>)}
          </div>
        </section>
      </div>
    </fieldset>
  </div>;
}
