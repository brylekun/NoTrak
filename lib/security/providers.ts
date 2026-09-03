export type ProviderStatus = "match" | "not_found" | "not_configured" | "unavailable";

export type UrlProviderResult = {
  provider: "Google Safe Browsing" | "URLhaus";
  status: ProviderStatus;
  threatTypes: string[];
};

export type MalwareProviderResult = {
  provider: "MalwareBazaar";
  status: "known_malicious" | "not_found" | "not_configured" | "provider_unavailable";
  signature?: string;
  firstSeen?: string;
  fileType?: string;
  tags?: string[];
};

type Fetcher = typeof fetch;

async function fetchWithTimeout(fetcher: Fetcher, input: string | URL, init: RequestInit) {
  return fetcher(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(6_000) });
}

export async function queryGoogleSafeBrowsing(url: string, apiKey: string | undefined, fetcher: Fetcher = fetch): Promise<UrlProviderResult> {
  const base: UrlProviderResult = { provider: "Google Safe Browsing", status: "not_configured", threatTypes: [] };
  if (!apiKey) return base;
  try {
    const endpoint = new URL("https://safebrowsing.googleapis.com/v5/urls:search");
    endpoint.searchParams.set("key", apiKey);
    endpoint.searchParams.append("urls", url);
    const response = await fetchWithTimeout(fetcher, endpoint, { method: "GET", headers: { Accept: "application/json" } });
    if (!response.ok) return { ...base, status: "unavailable" };
    const payload = await response.json() as { threats?: Array<{ threatTypes?: unknown }> };
    if (!Array.isArray(payload.threats)) return { ...base, status: "unavailable" };
    const threatTypes = payload.threats.flatMap((item) => Array.isArray(item.threatTypes) ? item.threatTypes.filter((value): value is string => typeof value === "string").slice(0, 8) : []);
    return { ...base, status: payload.threats.length ? "match" : "not_found", threatTypes: [...new Set(threatTypes)] };
  } catch {
    return { ...base, status: "unavailable" };
  }
}

export async function queryUrlhaus(url: string, authKey: string | undefined, fetcher: Fetcher = fetch): Promise<UrlProviderResult> {
  const base: UrlProviderResult = { provider: "URLhaus", status: "not_configured", threatTypes: [] };
  if (!authKey) return base;
  try {
    const response = await fetchWithTimeout(fetcher, "https://urlhaus-api.abuse.ch/v1/url/", {
      method: "POST",
      headers: { Accept: "application/json", "Auth-Key": authKey, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ url }),
    });
    if (!response.ok) return { ...base, status: "unavailable" };
    const payload = await response.json() as { query_status?: unknown; threat?: unknown; tags?: unknown };
    if (payload.query_status === "no_results") return { ...base, status: "not_found" };
    if (payload.query_status !== "ok") return { ...base, status: "unavailable" };
    const values = [payload.threat, ...(Array.isArray(payload.tags) ? payload.tags : [])].filter((value): value is string => typeof value === "string").slice(0, 8);
    return { ...base, status: "match", threatTypes: [...new Set(values)] };
  } catch {
    return { ...base, status: "unavailable" };
  }
}

export async function queryMalwareBazaar(sha256: string, authKey: string | undefined, fetcher: Fetcher = fetch): Promise<MalwareProviderResult> {
  const base: MalwareProviderResult = { provider: "MalwareBazaar", status: "not_configured" };
  if (!authKey) return base;
  try {
    const response = await fetchWithTimeout(fetcher, "https://mb-api.abuse.ch/api/v1/", {
      method: "POST",
      headers: { Accept: "application/json", "Auth-Key": authKey, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ query: "get_info", hash: sha256 }),
    });
    if (!response.ok) return { ...base, status: "provider_unavailable" };
    const payload = await response.json() as { query_status?: unknown; data?: unknown };
    if (payload.query_status === "hash_not_found" || payload.query_status === "no_results") return { ...base, status: "not_found" };
    if (payload.query_status !== "ok" || !Array.isArray(payload.data) || !payload.data[0] || typeof payload.data[0] !== "object") {
      return { ...base, status: "provider_unavailable" };
    }
    const item = payload.data[0] as Record<string, unknown>;
    return {
      ...base,
      status: "known_malicious",
      signature: typeof item.signature === "string" ? item.signature.slice(0, 120) : undefined,
      firstSeen: typeof item.first_seen === "string" ? item.first_seen.slice(0, 40) : undefined,
      fileType: typeof item.file_type === "string" ? item.file_type.slice(0, 40) : undefined,
      tags: Array.isArray(item.tags) ? item.tags.filter((value): value is string => typeof value === "string").slice(0, 8) : undefined,
    };
  } catch {
    return { ...base, status: "provider_unavailable" };
  }
}
