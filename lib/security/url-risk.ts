export type UrlRiskLevel = "low" | "caution" | "high";

export type UrlRiskSignal = {
  id: string;
  label: string;
  detail: string;
  weight: number;
};

export type UrlLocalAssessment = {
  normalizedUrl: string;
  hostname: string;
  score: number;
  level: UrlRiskLevel;
  signals: UrlRiskSignal[];
};

const SHORTENERS = new Set([
  "bit.ly", "buff.ly", "cutt.ly", "goo.gl", "is.gd", "ow.ly", "rebrand.ly", "t.co", "tiny.cc", "tinyurl.com",
]);
const SUSPICIOUS_WORDS = /(?:account|auth|billing|confirm|invoice|login|password|payment|recover|secure|signin|support|update|verify|wallet)/iu;
const COMMON_PORTS = new Set(["", "80", "443"]);

function signal(id: string, label: string, detail: string, weight: number): UrlRiskSignal {
  return { id, label, detail, weight };
}

function isIpHostname(hostname: string) {
  const bare = hostname.replace(/^\[|\]$/gu, "");
  if (bare.includes(":")) return /^[0-9a-f:]+$/iu.test(bare);
  const parts = bare.split(".");
  return parts.length === 4 && parts.every((part) => /^\d{1,3}$/u.test(part) && Number(part) <= 255);
}

function isPrivateOrLocalHostname(hostname: string) {
  const bare = hostname.replace(/^\[|\]$/gu, "").toLowerCase();
  if (bare === "localhost" || bare.endsWith(".localhost") || bare.endsWith(".local")) return true;
  if (bare.includes(":")) return bare === "::1" || bare.startsWith("fc") || bare.startsWith("fd") || bare.startsWith("fe8") || bare.startsWith("fe9") || bare.startsWith("fea") || bare.startsWith("feb");
  const parts = bare.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false;
  return parts[0] === 0 || parts[0] === 10 || parts[0] === 127 || parts[0] >= 224
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168);
}

function rawHostname(input: string) {
  const authority = input.match(/^https?:\/\/([^/?#]+)/iu)?.[1] ?? "";
  return authority.replace(/^.*@/u, "").replace(/:\d+$/u, "").replace(/^\[|\]$/gu, "");
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

export function parsePublicHttpUrl(input: string) {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Enter a URL to inspect.");
  if (trimmed.length > 2048) throw new Error("The URL is too long.");

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("Enter a complete http:// or https:// URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS URLs can be checked.");
  }
  if (url.username || url.password) throw new Error("URLs containing usernames or passwords are not accepted.");
  if (!url.hostname || url.hostname.length > 253) throw new Error("The URL hostname is invalid.");
  if (isPrivateOrLocalHostname(url.hostname)) throw new Error("Private, local, and loopback addresses are not sent to reputation providers.");
  return url;
}

export function analyzeUrlLocally(input: string): UrlLocalAssessment {
  const url = parsePublicHttpUrl(input);
  const hostname = url.hostname.toLowerCase();
  const signals: UrlRiskSignal[] = [];

  if (url.protocol === "http:") signals.push(signal("http", "Unencrypted HTTP", "The connection would not protect traffic in transit.", 12));
  if (isIpHostname(hostname)) signals.push(signal("ip-host", "Raw IP address", "The link uses an IP address instead of a normal domain name.", 22));
  if (hostname.includes("xn--")) signals.push(signal("punycode", "Internationalized hostname", "The hostname uses Punycode; check the displayed spelling carefully.", 18));
  if (hasMixedScripts(rawHostname(input))) signals.push(signal("mixed-script", "Mixed writing systems", "The hostname combines scripts that can make lookalike domains harder to spot.", 28));
  if (!COMMON_PORTS.has(url.port)) signals.push(signal("port", "Unusual network port", `The link specifies port ${url.port}.`, 14));

  const labels = hostname.replace(/^\[|\]$/gu, "").split(".");
  if (labels.length > 5) signals.push(signal("subdomains", "Many subdomains", "A long chain of subdomains can obscure the registrable domain.", 10));
  if (hostname.length > 80) signals.push(signal("long-host", "Long hostname", "The hostname is unusually long and deserves careful review.", 10));
  if (SHORTENERS.has(hostname)) signals.push(signal("shortener", "Shortened destination", "The visible link hides its eventual destination.", 18));
  if (SUSPICIOUS_WORDS.test(`${hostname}${url.pathname}`)) signals.push(signal("keywords", "High-pressure wording", "The address contains account, payment, login, or verification language.", 10));
  if (/%(?:2f|40|5c)/iu.test(input)) signals.push(signal("encoding", "Encoded separators", "Encoded separators can make an address harder to read.", 12));
  if (url.href.length > 500) signals.push(signal("length", "Very long URL", "The full address is unusually long.", 8));

  const score = Math.min(100, signals.reduce((total, item) => total + item.weight, 0));
  const level: UrlRiskLevel = score >= 45 ? "high" : score >= 15 ? "caution" : "low";
  return { normalizedUrl: url.href, hostname, score, level, signals };
}

export function mergeProviderRisk(local: UrlLocalAssessment, matched: boolean) {
  const score = matched ? Math.max(85, local.score) : local.score;
  return { score, level: (score >= 45 ? "high" : score >= 15 ? "caution" : "low") as UrlRiskLevel };
}
