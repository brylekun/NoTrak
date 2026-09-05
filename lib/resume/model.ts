import { z } from "zod";

export const MAX_DRAFT_BYTES = 256 * 1024;
export const MAX_ENTRIES = 12;
export const sectionNames = {
  summary: "Summary", experience: "Experience", education: "Education", skills: "Skills", projects: "Projects",
} as const;
export type SectionId = keyof typeof sectionNames;
export type EntrySection = "experience" | "education" | "projects";
export const sectionIds = Object.keys(sectionNames) as SectionId[];

const shortText = z.string().max(200);
const entrySchema = z.object({
  id: z.string().min(1).max(60),
  title: shortText, organization: shortText, location: shortText, dates: shortText,
  url: z.string().max(400), details: z.string().max(3000),
}).strict();
export type ResumeEntry = z.infer<typeof entrySchema>;

const resumeSchema = z.object({
  format: z.literal("notrak-resume"), version: z.literal(1),
  template: z.enum(["classic", "compact"]), paper: z.enum(["a4", "letter"]),
  contact: z.object({ name: shortText, headline: shortText, email: shortText, phone: shortText, location: shortText, website: z.string().max(400) }).strict(),
  summary: z.string().max(3000), skills: z.string().max(2000),
  experience: z.array(entrySchema).max(MAX_ENTRIES),
  education: z.array(entrySchema).max(MAX_ENTRIES),
  projects: z.array(entrySchema).max(MAX_ENTRIES),
  sections: z.array(z.object({ id: z.enum(["summary", "experience", "education", "skills", "projects"]), enabled: z.boolean() }).strict()).length(5),
}).strict().superRefine((value, ctx) => {
  if (new Set(value.sections.map((s) => s.id)).size !== 5) ctx.addIssue({ code: "custom", message: "Invalid section order" });
  const ids = [...value.experience, ...value.education, ...value.projects].map((entry) => entry.id);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: "Duplicate entries" });
  if (JSON.stringify(value).length > 40000) ctx.addIssue({ code: "custom", message: "Draft too large" });
});
export type ResumeDraft = z.infer<typeof resumeSchema>;

export function blankResume(): ResumeDraft {
  return {
    format: "notrak-resume", version: 1, template: "classic", paper: "a4",
    contact: { name: "", headline: "", email: "", phone: "", location: "", website: "" },
    summary: "", skills: "", experience: [], education: [], projects: [],
    sections: sectionIds.map((id) => ({ id, enabled: true })),
  };
}

export function blankEntry(): ResumeEntry {
  return { id: crypto.randomUUID(), title: "", organization: "", location: "", dates: "", url: "", details: "" };
}

export function validateResume(value: unknown): ResumeDraft {
  const result = resumeSchema.safeParse(value);
  if (!result.success) throw new Error("This draft is invalid or exceeds the resume limits. Use a NoTrak resume draft with up to 12 entries per section and 40,000 characters total.");
  return result.data;
}

export function parseResumeDraft(text: string): ResumeDraft {
  if (new TextEncoder().encode(text).byteLength > MAX_DRAFT_BYTES) throw new Error("Choose a resume draft smaller than 256 KB.");
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error("This file is not a valid NoTrak resume draft."); }
  return validateResume(parsed);
}

export function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** Only user-entered HTTPS/HTTP destinations become PDF or preview links. */
export function resumeLink(value: string): string | undefined {
  const text = value.trim();
  if (!text) return;
  try {
    const url = new URL(text);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return;
    return url.href;
  } catch { return; }
}

export function sampleResume(): ResumeDraft {
  const draft = blankResume();
  return {
    ...draft,
    contact: { name: "Alex Rivera", headline: "Customer Support Specialist", email: "alex@example.com", phone: "+63 912 345 6789", location: "Cebu City, Philippines", website: "https://example.com/portfolio" },
    summary: "Customer support professional with three years of experience helping customers resolve problems clearly and quickly. Comfortable coordinating across teams, documenting solutions, and improving everyday processes.",
    experience: [{ id: "sample-work", title: "Customer Support Specialist", organization: "Example Company", location: "Cebu City", dates: "June 2023 - Present", url: "", details: "Resolved customer questions through email and chat while maintaining clear case notes.\nCreated a shared troubleshooting guide that reduced repeat questions.\nSupported onboarding for four new teammates." }],
    education: [{ id: "sample-education", title: "Bachelor of Arts in Communication", organization: "Example University", location: "Cebu City", dates: "2019 - 2023", url: "", details: "Completed a capstone project on accessible customer communication." }],
    skills: "Customer communication, problem solving, documentation, spreadsheets, team coordination",
    projects: [{ id: "sample-project", title: "Community Resource Directory", organization: "Volunteer project", location: "", dates: "2024", url: "https://example.com/community", details: "Organized local support resources into a searchable directory for community volunteers." }],
  };
}
