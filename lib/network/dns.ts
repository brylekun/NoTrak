import { z } from "zod";

export const CLOUDFLARE_DOH_URL = "https://cloudflare-dns.com/dns-query";
export const DNS_RECORD_TYPES = ["A", "AAAA", "CNAME", "MX", "NS", "TXT", "CAA", "SOA"] as const;
export type DnsRecordType = (typeof DNS_RECORD_TYPES)[number];

const TYPE_NAMES: Record<number, string> = {
  1: "A",
  2: "NS",
  5: "CNAME",
  6: "SOA",
  15: "MX",
  16: "TXT",
  28: "AAAA",
  46: "RRSIG",
  257: "CAA",
};

const STATUS_NAMES: Record<number, string> = {
  0: "No error",
  1: "Format error",
  2: "Server failure",
  3: "Domain does not exist",
  4: "Not implemented",
  5: "Query refused",
};

const dnsRecordSchema = z.object({
  // A fully qualified wire-format name can include a final root dot.
  name: z.string().max(255),
  type: z.number().int().min(0).max(65_535),
  TTL: z.number().int().min(0).max(4_294_967_295),
  data: z.string().max(65_535),
});

const dnsResponseSchema = z.object({
  Status: z.number().int().min(0).max(65_535),
  TC: z.boolean(),
  RD: z.boolean(),
  RA: z.boolean(),
  AD: z.boolean(),
  CD: z.boolean(),
  Answer: z.array(dnsRecordSchema).max(500).optional(),
});

export type DomainInspection = {
  domain: string;
  labels: string[];
  sourceWasUrl: boolean;
  usesPunycode: boolean;
};

export type DnsLookupResult = {
  status: number;
  statusLabel: string;
  authenticatedData: boolean;
  truncated: boolean;
  answers: Array<{ name: string; type: string; ttl: number; data: string }>;
};

export function inspectDomainInput(input: string): DomainInspection {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Enter a domain name or website URL.");
  if (trimmed.length > 2_048) throw new Error("The submitted value is too long.");

  const hasScheme = /^[a-z][a-z\d+.-]*:/iu.test(trimmed);
  let parsed: URL;
  try {
    parsed = new URL(hasScheme ? trimmed : `https://${trimmed}`);
  } catch {
    throw new Error("Enter a valid domain such as example.com.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only website domain names and HTTP or HTTPS URLs are accepted.");
  }
  if (parsed.username || parsed.password) throw new Error("URLs containing usernames or passwords are not accepted.");

  const domain = parsed.hostname.toLocaleLowerCase("en-US").replace(/\.$/u, "");
  const labels = domain.split(".");
  if (!domain || domain.length > 253 || labels.some((label) => !label || label.length > 63)) {
    throw new Error("The domain name has an invalid length or empty label.");
  }
  if (labels.length < 2 || domain === "localhost" || domain.endsWith(".localhost") || domain.endsWith(".local")) {
    throw new Error("Enter a public domain name with at least two labels.");
  }
  if (labels.some((label) => !/^[a-z\d_](?:[a-z\d_-]*[a-z\d_])?$/u.test(label))) {
    throw new Error("The domain contains characters that cannot be queried safely.");
  }
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/u.test(domain) || domain.includes(":")) {
    throw new Error("Enter a domain name rather than an IP address.");
  }

  return {
    domain,
    labels,
    sourceWasUrl: hasScheme || parsed.pathname !== "/" || Boolean(parsed.search || parsed.hash || parsed.port),
    usesPunycode: labels.some((label) => label.startsWith("xn--")),
  };
}

export function dnsLookupUrl(domain: string, type: DnsRecordType) {
  const url = new URL(CLOUDFLARE_DOH_URL);
  url.searchParams.set("name", domain);
  url.searchParams.set("type", type);
  url.searchParams.set("do", "true");
  return url.toString();
}

export function parseDnsResponse(payload: unknown): DnsLookupResult {
  const parsed = dnsResponseSchema.safeParse(payload);
  if (!parsed.success) throw new Error("The DNS resolver returned an unreadable response.");
  const response = parsed.data;
  return {
    status: response.Status,
    statusLabel: STATUS_NAMES[response.Status] ?? `DNS response code ${response.Status}`,
    authenticatedData: response.AD,
    truncated: response.TC,
    answers: (response.Answer ?? []).map((answer) => ({
      name: answer.name.replace(/\.$/u, ""),
      type: TYPE_NAMES[answer.type] ?? `TYPE${answer.type}`,
      ttl: answer.TTL,
      data: answer.data,
    })),
  };
}

export function formatDnsTtl(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3_600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3_600)}h ${Math.floor(seconds % 3_600 / 60)}m`;
  return `${Math.floor(seconds / 86_400)}d ${Math.floor(seconds % 86_400 / 3_600)}h`;
}
