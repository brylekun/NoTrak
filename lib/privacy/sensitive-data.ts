/*
 * Conservative, local-only sensitive-data detection.
 *
 * This module finds high-confidence patterns rather than claiming to discover
 * all personal or secret information. It deliberately does not guess names,
 * street addresses, or unformatted phone numbers because those heuristics
 * generate too many misleading matches without a language model or data
 * service. No processing in this module requires a network request.
 */

export const MAX_REDACTOR_CHARACTERS = 1_000_000;
export const MAX_REDACTOR_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_REDACTOR_FINDINGS = 500;

type TextFileLike = Pick<File, "name" | "size" | "type">;

const TEXT_FILE_EXTENSIONS = new Set(["csv", "json", "log", "md", "text", "txt"]);
const TEXT_FILE_TYPES = new Set([
  "application/json",
  "application/ld+json",
  "text/csv",
  "text/markdown",
  "text/plain",
]);

export function validateSensitiveTextFile(file: TextFileLike) {
  if (file.size === 0) throw new Error("The selected file is empty.");
  if (file.size > MAX_REDACTOR_FILE_BYTES) throw new Error("Choose a text-based file no larger than 5 MB.");
  const extension = file.name.toLowerCase().split(".").at(-1) ?? "";
  const recognizedExtension = TEXT_FILE_EXTENSIONS.has(extension);
  const recognizedType = !file.type || TEXT_FILE_TYPES.has(file.type);
  if (!recognizedExtension && !recognizedType) {
    throw new Error("Choose a TXT, LOG, CSV, JSON, Markdown, or other plain-text file.");
  }
}

export type SensitiveDataKind =
  | "private-key"
  | "jwt"
  | "api-token"
  | "url-secret"
  | "email"
  | "payment-card"
  | "ipv4"
  | "ipv6"
  | "phone";

export type SensitiveOccurrence = {
  start: number;
  end: number;
};

export type SensitiveFinding = {
  id: string;
  kind: SensitiveDataKind;
  label: string;
  value: string;
  preview: string;
  placeholder: string;
  occurrences: SensitiveOccurrence[];
};

export type SensitiveScan = {
  findings: SensitiveFinding[];
  occurrenceCount: number;
  truncated: boolean;
};

type Candidate = SensitiveOccurrence & {
  kind: SensitiveDataKind;
  value: string;
  priority: number;
};

export const SENSITIVE_DATA_LABELS: Record<SensitiveDataKind, string> = {
  "private-key": "Private key",
  jwt: "JSON Web Token",
  "api-token": "Password or API token",
  "url-secret": "Secret inside a URL",
  email: "Email address",
  "payment-card": "Payment-card number",
  ipv4: "IPv4 address",
  ipv6: "IPv6 address",
  phone: "Phone number",
};

const PLACEHOLDER_NAMES: Record<SensitiveDataKind, string> = {
  "private-key": "PRIVATE_KEY",
  jwt: "JWT",
  "api-token": "SECRET",
  "url-secret": "URL_SECRET",
  email: "EMAIL",
  "payment-card": "PAYMENT_CARD",
  ipv4: "IP_ADDRESS",
  ipv6: "IP_ADDRESS",
  phone: "PHONE",
};

const KNOWN_TOKEN_PATTERNS = [
  /\bAKIA[0-9A-Z]{16}\b/gu,
  /\bAIza[0-9A-Za-z_-]{35}\b/gu,
  /\bgh[pousr]_[A-Za-z0-9]{20,255}\b/gu,
  /\bgithub_pat_[A-Za-z0-9_]{20,255}\b/gu,
  /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/gu,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/gu,
] as const;

const SENSITIVE_QUERY_NAMES = new Set([
  "access_token",
  "api_key",
  "apikey",
  "auth",
  "authorization",
  "client_secret",
  "key",
  "password",
  "passwd",
  "secret",
  "sig",
  "signature",
  "token",
  "x-amz-credential",
  "x-amz-security-token",
  "x-amz-signature",
]);

function addMatches(candidates: Candidate[], text: string, pattern: RegExp, kind: SensitiveDataKind, priority: number) {
  pattern.lastIndex = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index === undefined || !match[0]) continue;
    candidates.push({
      kind,
      priority,
      value: match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
  }
}

function luhnValid(value: string) {
  const digits = value.replace(/\D/gu, "");
  if (digits.length < 13 || digits.length > 19 || /^(\d)\1+$/u.test(digits)) return false;

  let total = 0;
  let double = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    total += digit;
    double = !double;
  }
  return total % 10 === 0;
}

function validIpv4(value: string) {
  const parts = value.split(".");
  return parts.length === 4
    && parts.every((part) => /^\d{1,3}$/u.test(part) && Number(part) >= 0 && Number(part) <= 255);
}

function validIpv6(value: string) {
  if (!value.includes(":")) return false;
  if (!/^[0-9a-f:]+$/iu.test(value) || value.includes(":::")) return false;
  const halves = value.split("::");
  if (halves.length > 2) return false;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  if (![...left, ...right].every((part) => /^[0-9a-f]{1,4}$/iu.test(part))) return false;
  return halves.length === 2 ? left.length + right.length < 8 : left.length === 8;
}

function findPrivateKeys(text: string, candidates: Candidate[]) {
  const pattern = /-----BEGIN ((?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY)-----[\s\S]*?-----END \1-----/gu;
  addMatches(candidates, text, pattern, "private-key", 100);
}

function findKnownTokens(text: string, candidates: Candidate[]) {
  for (const pattern of KNOWN_TOKEN_PATTERNS) addMatches(candidates, text, pattern, "api-token", 90);
}

function findGenericSecrets(text: string, candidates: Candidate[]) {
  const pattern = /\b(?:api[_-]?key|authorization|client[_-]?secret|password|passwd|secret|token)\b\s*[:=]\s*(?:Bearer\s+)?(?:"([^"\r\n]{4,})"|'([^'\r\n]{4,})'|([^\s,;]{6,}))/giu;
  for (const match of text.matchAll(pattern)) {
    if (match.index === undefined) continue;
    const value = match[1] ?? match[2] ?? match[3];
    if (!value) continue;
    const relative = match[0].lastIndexOf(value);
    const start = match.index + relative;
    candidates.push({ kind: "api-token", priority: 85, value, start, end: start + value.length });
  }
}

function trimUrlPunctuation(value: string) {
  return value.replace(/[),.;!?]+$/gu, "");
}

function findUrlSecrets(text: string, candidates: Candidate[]) {
  const urlPattern = /https?:\/\/[^\s<>"']+/giu;
  for (const match of text.matchAll(urlPattern)) {
    if (match.index === undefined) continue;
    const rawUrl = trimUrlPunctuation(match[0]);
    const base = match.index;

    const userInfo = /^https?:\/\/([^/@\s]+)@/iu.exec(rawUrl);
    if (userInfo?.[1]) {
      const start = base + rawUrl.indexOf(userInfo[1]);
      candidates.push({
        kind: "url-secret",
        priority: 88,
        value: userInfo[1],
        start,
        end: start + userInfo[1].length,
      });
    }

    const queryStart = rawUrl.indexOf("?");
    if (queryStart === -1) continue;
    const query = rawUrl.slice(queryStart + 1).split("#", 1)[0];
    let cursor = 0;
    for (const segment of query.split("&")) {
      const equals = segment.indexOf("=");
      if (equals > 0) {
        const rawName = segment.slice(0, equals);
        const rawValue = segment.slice(equals + 1);
        let decodedName = rawName.toLowerCase();
        try { decodedName = decodeURIComponent(rawName).toLowerCase(); } catch { /* Keep the raw name. */ }
        if (rawValue && SENSITIVE_QUERY_NAMES.has(decodedName)) {
          const start = base + queryStart + 1 + cursor + equals + 1;
          candidates.push({ kind: "url-secret", priority: 88, value: rawValue, start, end: start + rawValue.length });
        }
      }
      cursor += segment.length + 1;
    }
  }
}

function findPaymentCards(text: string, candidates: Candidate[]) {
  const pattern = /(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)/gu;
  for (const match of text.matchAll(pattern)) {
    if (match.index === undefined || !luhnValid(match[0])) continue;
    candidates.push({
      kind: "payment-card",
      priority: 80,
      value: match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
  }
}

function findIpAddresses(text: string, candidates: Candidate[]) {
  const ipv4Pattern = /(?<![\d.])\d{1,3}(?:\.\d{1,3}){3}(?![\d.])/gu;
  for (const match of text.matchAll(ipv4Pattern)) {
    if (match.index === undefined || !validIpv4(match[0])) continue;
    candidates.push({ kind: "ipv4", priority: 70, value: match[0], start: match.index, end: match.index + match[0].length });
  }

  const ipv6Pattern = /(?<![0-9A-Fa-f:])(?:[0-9A-Fa-f]{0,4}:){2,7}[0-9A-Fa-f]{0,4}(?![0-9A-Fa-f:])/gu;
  for (const match of text.matchAll(ipv6Pattern)) {
    if (match.index === undefined || !validIpv6(match[0])) continue;
    candidates.push({ kind: "ipv6", priority: 70, value: match[0], start: match.index, end: match.index + match[0].length });
  }
}

function findPhones(text: string, candidates: Candidate[]) {
  const pattern = /(?<![\dA-Za-z])(?:\+\d|\(\d{1,4}\)|\d)[\d ().-]{5,}\d(?![\dA-Za-z])/gu;
  for (const match of text.matchAll(pattern)) {
    if (match.index === undefined) continue;
    const value = match[0];
    const digits = value.replace(/\D/gu, "");
    const formatted = value.startsWith("+") || /[ ().-]/u.test(value);
    if (!formatted || digits.length < 7 || digits.length > 15) continue;
    if (digits.length >= 13 && !value.startsWith("+")) continue;
    if (/^\d{4}-\d{1,2}-\d{1,2}(?:\s+\d{1,2})?$/u.test(value)) continue;
    candidates.push({ kind: "phone", priority: 60, value, start: match.index, end: match.index + value.length });
  }
}

function overlaps(candidate: SensitiveOccurrence, accepted: Candidate[]) {
  return accepted.some((item) => candidate.start < item.end && candidate.end > item.start);
}

function maskedValue(value: string, kind: SensitiveDataKind) {
  if (kind === "private-key") return `${value.slice(0, 27)}…${value.slice(-25)}`;
  if (kind === "email") {
    const at = value.lastIndexOf("@");
    return at > 0 ? `${value.slice(0, Math.min(2, at))}•••${value.slice(at)}` : "•••";
  }
  if (kind === "payment-card" || kind === "phone") {
    const digits = value.replace(/\D/gu, "");
    return `•••• ${digits.slice(-4)}`;
  }
  if (kind === "ipv4") {
    const parts = value.split(".");
    return `${parts[0]}.•••.•••.${parts.at(-1)}`;
  }
  if (kind === "ipv6") {
    const parts = value.split(":");
    return `${parts[0] || "::"}:•••:${parts.at(-1) || "0"}`;
  }
  if (value.length <= 10) return `${value.slice(0, 2)}•••${value.slice(-2)}`;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function scanSensitiveData(text: string): SensitiveScan {
  if (text.length > MAX_REDACTOR_CHARACTERS) {
    throw new Error(`Text must not exceed ${MAX_REDACTOR_CHARACTERS.toLocaleString()} characters.`);
  }
  if (!text.trim()) return { findings: [], occurrenceCount: 0, truncated: false };

  const candidates: Candidate[] = [];
  findPrivateKeys(text, candidates);
  addMatches(candidates, text, /\beyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]*\b/gu, "jwt", 95);
  findKnownTokens(text, candidates);
  findGenericSecrets(text, candidates);
  findUrlSecrets(text, candidates);
  addMatches(candidates, text, /\b[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+\b/giu, "email", 75);
  findPaymentCards(text, candidates);
  findIpAddresses(text, candidates);
  findPhones(text, candidates);

  const accepted: Candidate[] = [];
  for (const candidate of candidates.sort((a, b) => b.priority - a.priority || b.value.length - a.value.length || a.start - b.start)) {
    if (!overlaps(candidate, accepted)) accepted.push(candidate);
  }
  accepted.sort((a, b) => a.start - b.start || a.end - b.end);

  const groups = new Map<string, SensitiveFinding>();
  const placeholderCounts = new Map<string, number>();
  let truncated = false;
  for (const candidate of accepted) {
    const key = `${candidate.kind}\u0000${candidate.value}`;
    const existing = groups.get(key);
    if (existing) {
      existing.occurrences.push({ start: candidate.start, end: candidate.end });
      continue;
    }
    if (groups.size >= MAX_REDACTOR_FINDINGS) {
      truncated = true;
      continue;
    }
    const placeholderName = PLACEHOLDER_NAMES[candidate.kind];
    const count = (placeholderCounts.get(placeholderName) ?? 0) + 1;
    placeholderCounts.set(placeholderName, count);
    groups.set(key, {
      id: `${candidate.kind}-${count}`,
      kind: candidate.kind,
      label: SENSITIVE_DATA_LABELS[candidate.kind],
      value: candidate.value,
      preview: maskedValue(candidate.value, candidate.kind),
      placeholder: `[${placeholderName}_${count}]`,
      occurrences: [{ start: candidate.start, end: candidate.end }],
    });
  }

  const findings = [...groups.values()];
  return {
    findings,
    occurrenceCount: findings.reduce((sum, finding) => sum + finding.occurrences.length, 0),
    truncated,
  };
}

export function redactSensitiveData(text: string, findings: SensitiveFinding[], selectedIds: ReadonlySet<string>) {
  const replacements = findings
    .filter((finding) => selectedIds.has(finding.id))
    .flatMap((finding) => finding.occurrences.map((occurrence) => ({ ...occurrence, replacement: finding.placeholder })))
    .sort((a, b) => b.start - a.start || b.end - a.end);

  let result = text;
  for (const replacement of replacements) {
    result = `${result.slice(0, replacement.start)}${replacement.replacement}${result.slice(replacement.end)}`;
  }
  return result;
}

export function redactedTextName(filename?: string) {
  if (!filename) return "notrak-redacted.txt";
  const match = /^(.*?)(\.[^.]+)?$/u.exec(filename);
  const base = match?.[1]?.trim() || "document";
  const extension = match?.[2] || ".txt";
  return `${base}-redacted${extension}`;
}
