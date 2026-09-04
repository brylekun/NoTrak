/*
 * Local email header analysis.
 *
 * Everything here is pure string parsing so a pasted header block never leaves
 * the browser. Headers routinely contain recipient names, internal hostnames,
 * and originating IP addresses, which is exactly why this must not become a
 * server round trip.
 *
 * Two honesty rules constrain the output:
 *   1. Authentication results are *reported by the receiving mail server*. This
 *      module never verifies a signature or queries DNS, so a "pass" is a claim
 *      that is only as trustworthy as the block it was pasted from.
 *   2. A clean report is not proof the message is legitimate. Signals explain
 *      what was observed; they never conclude that a message is safe.
 */

export const MAX_HEADER_CHARACTERS = 128 * 1024;
const MAX_HEADER_FIELDS = 2_000;
const MAX_HOPS = 60;

export type EmailRiskLevel = "low" | "caution" | "high";

export type EmailHeaderField = {
  name: string;
  value: string;
};

export type EmailAuthVerdict =
  | "pass"
  | "fail"
  | "softfail"
  | "neutral"
  | "none"
  | "policy"
  | "permerror"
  | "temperror"
  | "unknown";

export type EmailAuthResult = {
  /** Lowercased method name as written by the reporting server, e.g. `spf`. */
  method: string;
  verdict: EmailAuthVerdict;
  /** The reporting server's own identifier, when it named itself. */
  reportedBy?: string;
  /** Remaining properties from the clause, kept verbatim for evidence. */
  detail?: string;
};

export type EmailHop = {
  /** 1 for the earliest hop NoTrak can see, counting toward the recipient. */
  position: number;
  from?: string;
  by?: string;
  withProtocol?: string;
  ip?: string;
  ipIsPrivate?: boolean;
  timestamp?: string;
  epochMs?: number;
  /** Seconds between the previous hop and this one, when both had a usable date. */
  delaySeconds?: number;
};

export type EmailAddressField = {
  header: string;
  displayName?: string;
  address?: string;
  domain?: string;
  organizationalDomain?: string;
};

export type EmailSignal = {
  id: string;
  label: string;
  detail: string;
  weight: number;
};

export type EmailHeaderReport = {
  fields: EmailHeaderField[];
  fieldCount: number;
  subject?: string;
  date?: string;
  messageId?: string;
  addresses: EmailAddressField[];
  hops: EmailHop[];
  /** Earliest sending address visible in the Received chain, when present. */
  originatingIp?: string;
  originatingIpIsPrivate?: boolean;
  /** Total time across hops that reported a usable date. */
  transitSeconds?: number;
  auth: EmailAuthResult[];
  dkimSignatureCount: number;
  arcPresent: boolean;
  signals: EmailSignal[];
  score: number;
  level: EmailRiskLevel;
};

const ADDRESS_HEADERS = ["From", "Sender", "Reply-To", "Return-Path", "To", "Cc"] as const;
const SCORED_METHODS = new Set(["spf", "dkim", "dmarc"]);
const KNOWN_VERDICTS = new Set<EmailAuthVerdict>([
  "pass", "fail", "softfail", "neutral", "none", "policy", "permerror", "temperror",
]);
const URGENT_SUBJECT = /(?:account\s+(?:suspend|clos|lock)|action\s+required|confirm\s+your|final\s+(?:notice|warning)|immediately|invoice\s+(?:attached|overdue)|password\s+(?:expir|reset)|payment\s+(?:failed|declined)|unusual\s+(?:sign|activity)|urgent|verify\s+your)/iu;
const LONG_HOP_SECONDS = 6 * 60 * 60;

/*
 * A deliberately small two-part public-suffix list. This is a heuristic for
 * comparing organizational domains, not the full Public Suffix List, so the
 * wording it feeds always shows both domains and lets the reader judge.
 */
const TWO_PART_SUFFIXES = new Set([
  "ac.at", "ac.il", "ac.in", "ac.jp", "ac.kr", "ac.nz", "ac.uk", "ac.za",
  "co.id", "co.il", "co.in", "co.jp", "co.ke", "co.kr", "co.nz", "co.th", "co.uk", "co.za",
  "com.ar", "com.au", "com.bd", "com.br", "com.cn", "com.co", "com.do", "com.ec", "com.eg",
  "com.gh", "com.gt", "com.hk", "com.mx", "com.my", "com.ng", "com.pe", "com.ph", "com.pk",
  "com.pl", "com.sa", "com.sg", "com.tr", "com.tw", "com.ua", "com.uy", "com.vn",
  "edu.au", "edu.in", "go.jp", "gov.au", "gov.br", "gov.in", "gov.uk", "gov.za",
  "govt.nz", "ne.jp", "net.au", "net.nz", "net.za", "or.jp", "org.au", "org.br",
  "org.nz", "org.uk", "org.za",
]);

function signal(id: string, label: string, detail: string, weight: number): EmailSignal {
  return { id, label, detail, weight };
}

function collapse(value: string) {
  return value.replace(/[ \t]+/gu, " ").trim();
}

/** True for an IPv4 dotted quad or something that can only be an IPv6 literal. */
function isIpAddress(value: string) {
  const bare = value.replace(/^\[|\]$/gu, "");
  if (bare.includes(":")) return /^[0-9a-f:.]+$/iu.test(bare) && (bare.match(/:/gu)?.length ?? 0) >= 2;
  const parts = bare.split(".");
  return parts.length === 4 && parts.every((part) => /^\d{1,3}$/u.test(part) && Number(part) <= 255);
}

/**
 * Private, loopback, link-local, and unspecified ranges. An originating hop in
 * one of these ranges means the visible chain starts inside a network rather
 * than on the public internet.
 */
export function isPrivateIpAddress(value: string): boolean {
  const bare = value.replace(/^\[|\]$/gu, "").toLowerCase().replace(/^ipv6:/u, "");
  if (bare.includes(":")) {
    if (bare === "::" || bare === "::1") return true;
    if (bare.startsWith("::ffff:")) {
      const mapped = bare.slice("::ffff:".length);
      return isIpAddress(mapped) ? isPrivateIpAddress(mapped) : false;
    }
    return /^f[cd]/u.test(bare) || /^fe[89ab]/u.test(bare);
  }
  const parts = bare.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false;
  return parts[0] === 0 || parts[0] === 10 || parts[0] === 127
    || (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127)
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168);
}

/** Approximate registrable domain, used only to compare two domains. */
export function organizationalDomain(domain: string) {
  const labels = domain.toLowerCase().replace(/\.$/u, "").split(".").filter(Boolean);
  if (labels.length <= 2) return labels.join(".");
  const lastTwo = labels.slice(-2).join(".");
  return TWO_PART_SUFFIXES.has(lastTwo) ? labels.slice(-3).join(".") : lastTwo;
}

function hasMixedScripts(value: string) {
  const scripts = [
    /\p{Script=Latin}/u,
    /\p{Script=Cyrillic}/u,
    /\p{Script=Greek}/u,
    /\p{Script=Arabic}/u,
    /\p{Script=Hebrew}/u,
  ];
  return scripts.filter((pattern) => pattern.test(value)).length > 1;
}

/**
 * Unfold a pasted header block into ordered fields. Parsing stops at the blank
 * line that separates headers from the body, so a whole pasted message never
 * has its body read as headers.
 */
export function unfoldHeaderFields(raw: string): EmailHeaderField[] {
  const lines = raw.replace(/^﻿/u, "").split(/\r\n|\r|\n/u);
  const fields: EmailHeaderField[] = [];
  let name: string | null = null;
  let parts: string[] = [];

  function flush() {
    if (name !== null) fields.push({ name, value: collapse(parts.join(" ")) });
    name = null;
    parts = [];
  }

  for (const line of lines) {
    if (!line.trim()) {
      // A blank line before any header is leading whitespace; after one it ends
      // the header block.
      if (name !== null || fields.length > 0) break;
      continue;
    }
    if (fields.length >= MAX_HEADER_FIELDS) break;

    if (/^[ \t]/u.test(line) && name !== null) {
      parts.push(line.trim());
      continue;
    }

    const match = /^([!-9;-~]+)[ \t]*:[ \t]?(.*)$/u.exec(line);
    if (!match) {
      // Some mail clients drop the leading whitespace when a header block is
      // copied, so an unrecognized line is treated as a continuation rather
      // than discarded.
      if (name !== null) parts.push(line.trim());
      continue;
    }

    flush();
    name = match[1];
    parts = [match[2]];
  }

  flush();
  return fields;
}

function firstValue(fields: EmailHeaderField[], name: string) {
  const lowered = name.toLowerCase();
  return fields.find((field) => field.name.toLowerCase() === lowered)?.value;
}

function allValues(fields: EmailHeaderField[], name: string) {
  const lowered = name.toLowerCase();
  return fields.filter((field) => field.name.toLowerCase() === lowered).map((field) => field.value);
}

/** Parse a single mailbox, keeping the display name and the real addr-spec apart. */
export function parseMailbox(value: string) {
  const trimmed = collapse(value);
  if (!trimmed) return undefined;

  const angled = /<([^<>]*)>/u.exec(trimmed);
  const address = (angled ? angled[1] : trimmed.split(/[\s,]+/u)[0] ?? "").trim().replace(/^mailto:/iu, "");
  const rawDisplay = angled ? trimmed.slice(0, angled.index).trim() : "";
  const displayName = rawDisplay.replace(/^"(.*)"$/u, "$1").trim() || undefined;
  const domain = address.includes("@") ? address.slice(address.lastIndexOf("@") + 1).toLowerCase() || undefined : undefined;

  return {
    displayName,
    address: address || undefined,
    domain,
    organizationalDomain: domain ? organizationalDomain(domain) : undefined,
  };
}

function parseAddressFields(fields: EmailHeaderField[]): EmailAddressField[] {
  const parsed: EmailAddressField[] = [];
  for (const header of ADDRESS_HEADERS) {
    const value = firstValue(fields, header);
    if (value === undefined) continue;
    // `Return-Path: <>` is a legitimate null reverse path on bounces.
    const mailbox = parseMailbox(value);
    if (!mailbox) continue;
    parsed.push({ header, ...mailbox });
  }
  return parsed;
}

function normalizeVerdict(value: string): EmailAuthVerdict {
  const lowered = value.toLowerCase();
  return KNOWN_VERDICTS.has(lowered as EmailAuthVerdict) ? (lowered as EmailAuthVerdict) : "unknown";
}

function parseAuthenticationResults(fields: EmailHeaderField[]): EmailAuthResult[] {
  const results: EmailAuthResult[] = [];

  for (const value of allValues(fields, "Authentication-Results")) {
    const clauses = value.split(";").map(collapse).filter(Boolean);
    // The first clause is the reporting server's own identifier when it does
    // not itself look like a `method=result` pair.
    const reportedBy = clauses.length > 0 && !/^[A-Za-z0-9-]+\s*=/u.test(clauses[0]) ? clauses[0] : undefined;

    for (const clause of reportedBy ? clauses.slice(1) : clauses) {
      const match = /^([A-Za-z][A-Za-z0-9-]*)\s*=\s*([A-Za-z]+)(.*)$/u.exec(clause);
      if (!match) continue;
      results.push({
        method: match[1].toLowerCase(),
        verdict: normalizeVerdict(match[2]),
        reportedBy,
        detail: collapse(match[3]) || undefined,
      });
    }
  }

  // Older servers report SPF separately. It only fills a gap; it never
  // overrides an Authentication-Results verdict.
  if (!results.some((result) => result.method === "spf")) {
    const receivedSpf = firstValue(fields, "Received-SPF");
    const match = receivedSpf ? /^([A-Za-z]+)(.*)$/u.exec(collapse(receivedSpf)) : null;
    if (match) {
      results.push({
        method: "spf",
        verdict: normalizeVerdict(match[1]),
        detail: collapse(match[2]) || undefined,
      });
    }
  }

  return results;
}

function parseHop(value: string, position: number): EmailHop {
  const collapsed = collapse(value);
  const hop: EmailHop = { position };

  hop.from = /\bfrom\s+([^\s(;]+)/iu.exec(collapsed)?.[1];
  hop.by = /\bby\s+([^\s(;]+)/iu.exec(collapsed)?.[1];
  hop.withProtocol = /\bwith\s+([A-Za-z0-9]+)/iu.exec(collapsed)?.[1];

  // A bracketed literal is the address the receiving server actually saw, so it
  // wins over any bare address elsewhere in the line.
  const bracketed = [...collapsed.matchAll(/\[(?:IPv6:)?([^\]]+)\]/giu)]
    .map((match) => match[1].trim())
    .filter((candidate) => isIpAddress(candidate));
  const bare = bracketed.length > 0
    ? []
    : [...collapsed.matchAll(/\b\d{1,3}(?:\.\d{1,3}){3}\b/gu)]
      .map((match) => match[0])
      .filter((candidate) => isIpAddress(candidate));
  const ip = bracketed[0] ?? bare[0];
  if (ip) {
    hop.ip = ip;
    hop.ipIsPrivate = isPrivateIpAddress(ip);
  }

  // The date is the final semicolon-separated segment of a Received field.
  const separator = collapsed.lastIndexOf(";");
  const candidate = separator === -1 ? "" : collapsed.slice(separator + 1).trim();
  if (candidate) {
    const epochMs = Date.parse(candidate.replace(/\s*\([^)]*\)\s*$/u, ""));
    if (Number.isFinite(epochMs)) {
      hop.timestamp = candidate;
      hop.epochMs = epochMs;
    }
  }

  return hop;
}

/**
 * Build the delivery chain. Each server prepends its own Received field, so the
 * stored order runs newest to oldest; the returned chain is reversed to read
 * from the earliest visible hop toward the recipient.
 */
function parseHops(fields: EmailHeaderField[]): EmailHop[] {
  const received = allValues(fields, "Received").slice(0, MAX_HOPS).reverse();
  const hops = received.map((value, index) => parseHop(value, index + 1));

  let previous: number | undefined;
  for (const hop of hops) {
    if (previous !== undefined && hop.epochMs !== undefined) {
      hop.delaySeconds = Math.round((hop.epochMs - previous) / 1000);
    }
    if (hop.epochMs !== undefined) previous = hop.epochMs;
  }

  return hops;
}

function verdictOf(auth: EmailAuthResult[], method: string) {
  return auth.find((result) => result.method === method)?.verdict;
}

function describeDomains(a: string, b: string) {
  return `${a} vs ${b}`;
}

function collectSignals(report: Omit<EmailHeaderReport, "signals" | "score" | "level">): EmailSignal[] {
  const signals: EmailSignal[] = [];
  const { auth, hops, addresses } = report;
  const from = addresses.find((field) => field.header === "From");
  const scored = auth.filter((result) => SCORED_METHODS.has(result.method));

  const spf = verdictOf(auth, "spf");
  const dkim = verdictOf(auth, "dkim");
  const dmarc = verdictOf(auth, "dmarc");

  if (dmarc === "fail") {
    signals.push(signal("dmarc-fail", "DMARC failed", "The receiving server reported that the message did not pass the sending domain's DMARC policy. This is the strongest single indicator that the From address was not authorized.", 30));
  }
  if (spf === "fail") {
    signals.push(signal("spf-fail", "SPF failed", "The reporting server said the sending IP address is not authorized to send for the envelope domain.", 22));
  } else if (spf === "softfail") {
    signals.push(signal("spf-softfail", "SPF soft-failed", "The sending domain lists the source as probably unauthorized but stopped short of a hard failure.", 12));
  } else if (spf === "none" || spf === "permerror" || spf === "temperror") {
    signals.push(signal("spf-inconclusive", "SPF was inconclusive", `The reported SPF result was "${spf}", so nothing corroborates the envelope sender.`, 6));
  }

  if (dkim === "fail") {
    signals.push(signal("dkim-fail", "DKIM failed", "A signature was present but did not validate for the reporting server, which can mean tampering in transit or a forged signature.", 20));
  } else if (dkim !== "pass" && report.dkimSignatureCount === 0) {
    signals.push(signal("dkim-missing", "No DKIM signature", "The message carries no DKIM signature, so its content and sender cannot be cryptographically tied to a domain.", 10));
  }

  if (scored.length === 0) {
    signals.push(signal("no-auth-results", "No authentication results", "No Authentication-Results or Received-SPF header is present, so no receiving server recorded an SPF, DKIM, or DMARC verdict here.", 8));
  }

  if (from?.displayName) {
    const embedded = /[\w.!#$%&'*+/=?^`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/u.exec(from.displayName)?.[0];
    const embeddedDomain = embedded ? organizationalDomain(embedded.slice(embedded.lastIndexOf("@") + 1)) : undefined;
    if (embeddedDomain && from.organizationalDomain && embeddedDomain !== from.organizationalDomain) {
      signals.push(signal(
        "display-name-address",
        "Display name contains a different address",
        `The visible name shows ${embedded}, but the message is actually from ${from.address}. Most mail clients show only the name.`,
        26,
      ));
    }
    if (hasMixedScripts(from.displayName)) {
      signals.push(signal("display-name-scripts", "Display name mixes writing systems", "The sender name combines scripts, which is a common way to build a name that looks like a familiar brand.", 20));
    }
  }

  if (from?.domain?.includes("xn--")) {
    signals.push(signal("punycode-from", "Internationalized sender domain", `The From domain ${from.domain} is Punycode-encoded. Check the spelling it renders as very carefully.`, 16));
  } else if (from?.domain && hasMixedScripts(from.domain)) {
    signals.push(signal("from-domain-scripts", "Sender domain mixes writing systems", "The From domain combines scripts that can produce a convincing lookalike.", 20));
  }

  const replyTo = addresses.find((field) => field.header === "Reply-To");
  if (replyTo?.organizationalDomain && from?.organizationalDomain && replyTo.organizationalDomain !== from.organizationalDomain) {
    signals.push(signal(
      "reply-to-mismatch",
      "Replies go to another domain",
      `A reply would be addressed to ${replyTo.address} instead of the sending domain (${describeDomains(from.organizationalDomain, replyTo.organizationalDomain)}). Support desks do this legitimately, and so does redirected phishing.`,
      14,
    ));
  }

  const returnPath = addresses.find((field) => field.header === "Return-Path");
  // Mailing lists and marketing platforms legitimately send with their own
  // bounce domain, so this is only worth raising when DMARC did not pass.
  if (dmarc !== "pass" && returnPath?.organizationalDomain && from?.organizationalDomain
    && returnPath.organizationalDomain !== from.organizationalDomain) {
    signals.push(signal(
      "return-path-mismatch",
      "Bounce address is another domain",
      `Bounces would return to ${returnPath.address} (${describeDomains(from.organizationalDomain, returnPath.organizationalDomain)}). This is normal for mailing lists and sending platforms, but it is unverified here because DMARC did not pass.`,
      8,
    ));
  }

  const sender = addresses.find((field) => field.header === "Sender");
  if (sender?.organizationalDomain && from?.organizationalDomain && sender.organizationalDomain !== from.organizationalDomain) {
    signals.push(signal("sender-mismatch", "Submitted by another domain", `A Sender header names ${sender.address}, which means a different party submitted the message on the From domain's behalf.`, 6));
  }

  if (hops.length === 0) {
    signals.push(signal("no-received", "No delivery chain", "No Received headers are present, so the route cannot be traced. Partial header copies often lose them.", 12));
  } else if (report.originatingIpIsPrivate) {
    signals.push(signal("private-origin", "Chain starts on a private address", `The earliest visible hop came from ${report.originatingIp}, a private or loopback address, so the public origin is not in this block.`, 8));
  }

  if (hops.some((hop) => hop.delaySeconds !== undefined && hop.delaySeconds < -60)) {
    signals.push(signal("negative-delay", "Timestamps run backwards", "A hop is dated earlier than the hop before it. Clock drift can do this, and so can Received headers that were written by hand.", 10));
  }
  const longest = Math.max(0, ...hops.map((hop) => hop.delaySeconds ?? 0));
  if (longest >= LONG_HOP_SECONDS) {
    signals.push(signal("long-delay", "Long delay between hops", `One hop took about ${Math.round(longest / 3600)} hours, which can mean queueing, greylisting, or a message that was held before delivery.`, 5));
  }

  if (!report.messageId) {
    signals.push(signal("no-message-id", "No Message-ID", "Normal mail software always sets a Message-ID. Bulk sending scripts frequently omit it.", 10));
  } else {
    const idDomain = report.messageId.includes("@")
      ? organizationalDomain(report.messageId.slice(report.messageId.lastIndexOf("@") + 1).replace(/[<>]/gu, ""))
      : undefined;
    if (idDomain && from?.organizationalDomain && idDomain !== from.organizationalDomain) {
      signals.push(signal("message-id-mismatch", "Message-ID names another domain", `The Message-ID was issued by ${idDomain} rather than ${from.organizationalDomain}. Sending platforms do this routinely.`, 6));
    }
  }

  if (report.subject && URGENT_SUBJECT.test(report.subject)) {
    signals.push(signal("subject-pressure", "Time pressure in the subject", "The subject uses urgency or account-problem wording, the standard lever for getting someone to act before checking.", 6));
  }

  return signals;
}

export function analyzeEmailHeaders(input: string): EmailHeaderReport {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Paste an email header block to analyze.");
  if (input.length > MAX_HEADER_CHARACTERS) throw new Error("The header block is too large to analyze here.");

  const fields = unfoldHeaderFields(input);
  if (fields.length === 0) {
    throw new Error("No email headers were found. Paste the raw header block, where each line looks like \"Header-Name: value\".");
  }

  const hops = parseHops(fields);
  const auth = parseAuthenticationResults(fields);
  const originating = hops.find((hop) => hop.ip);
  const dated = hops.filter((hop) => hop.epochMs !== undefined);

  const base: Omit<EmailHeaderReport, "signals" | "score" | "level"> = {
    fields,
    fieldCount: fields.length,
    subject: firstValue(fields, "Subject"),
    date: firstValue(fields, "Date"),
    messageId: firstValue(fields, "Message-ID") ?? firstValue(fields, "Message-Id"),
    addresses: parseAddressFields(fields),
    hops,
    originatingIp: originating?.ip,
    originatingIpIsPrivate: originating?.ipIsPrivate,
    transitSeconds: dated.length > 1
      ? Math.round((dated[dated.length - 1].epochMs! - dated[0].epochMs!) / 1000)
      : undefined,
    auth,
    dkimSignatureCount: allValues(fields, "DKIM-Signature").length,
    arcPresent: fields.some((field) => field.name.toLowerCase().startsWith("arc-")),
  };

  const signals = collectSignals(base);
  const score = Math.min(100, signals.reduce((total, item) => total + item.weight, 0));
  const level: EmailRiskLevel = score >= 45 ? "high" : score >= 15 ? "caution" : "low";

  return { ...base, signals, score, level };
}

export function formatHopDelay(seconds: number) {
  const absolute = Math.abs(seconds);
  const sign = seconds < 0 ? "-" : "";
  if (absolute < 60) return `${sign}${absolute}s`;
  if (absolute < 3600) return `${sign}${Math.round(absolute / 60)}m`;
  if (absolute < 86_400) return `${sign}${(absolute / 3600).toFixed(1)}h`;
  return `${sign}${(absolute / 86_400).toFixed(1)}d`;
}
