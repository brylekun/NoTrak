import type {
  MalwareProviderStatus,
  ProviderFailureStatus,
  UrlProviderStatus,
} from "./provider-status";

export type ProviderStatus = UrlProviderStatus;

export type UrlProviderResult = {
  provider: "Google Safe Browsing" | "URLhaus";
  status: ProviderStatus;
  threatTypes: string[];
};

export type MalwareProviderResult = {
  provider: "MalwareBazaar";
  status: MalwareProviderStatus;
  signature?: string;
  firstSeen?: string;
  fileType?: string;
  tags?: string[];
};

type Fetcher = typeof fetch;

async function fetchWithTimeout(fetcher: Fetcher, input: string | URL, init: RequestInit) {
  return fetcher(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(6_000) });
}

function classifyFailedResponse(response: Response, limitedStatus: "rate_limited" | "quota_exceeded"): ProviderFailureStatus | null {
  if (response.ok) return null;
  if (response.status === 401 || response.status === 403) return "authentication_failed";
  if (response.status === 408) return "timed_out";
  if (response.status === 429) return limitedStatus;
  if (response.status >= 500) return "unavailable";
  return "invalid_response";
}

function classifyFetchFailure(reason: unknown): ProviderFailureStatus {
  const name = reason && typeof reason === "object" && "name" in reason
    ? String((reason as { name?: unknown }).name)
    : "";
  return name === "AbortError" || name === "TimeoutError" ? "timed_out" : "unavailable";
}

export async function queryGoogleSafeBrowsing(url: string, apiKey: string | undefined, fetcher: Fetcher = fetch): Promise<UrlProviderResult> {
  const base: UrlProviderResult = { provider: "Google Safe Browsing", status: "not_configured", threatTypes: [] };
  if (!apiKey) return base;
  let response: Response;
  try {
    response = await fetchWithTimeout(fetcher, "https://safebrowsing.googleapis.com/v4/threatMatches:find", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        client: { clientId: "notrak", clientVersion: "1.1" },
        threatInfo: {
          threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
          platformTypes: ["ANY_PLATFORM"],
          threatEntryTypes: ["URL"],
          threatEntries: [{ url }],
        },
      }),
    });
  } catch (reason) {
    return { ...base, status: classifyFetchFailure(reason) };
  }

  const failedStatus = classifyFailedResponse(response, "quota_exceeded");
  if (failedStatus) return { ...base, status: failedStatus };

  try {
    const payload = await response.json() as { matches?: unknown };
    if (payload.matches !== undefined && !Array.isArray(payload.matches)) return { ...base, status: "invalid_response" };
    const matches = (payload.matches ?? []) as Array<{ threatType?: unknown }>;
    const threatTypes = matches.map((item) => item?.threatType).filter((value): value is string => typeof value === "string").slice(0, 8);
    return { ...base, status: matches.length ? "match" : "not_found", threatTypes: [...new Set(threatTypes)] };
  } catch {
    return { ...base, status: "invalid_response" };
  }
}

export async function queryUrlhaus(url: string, authKey: string | undefined, fetcher: Fetcher = fetch): Promise<UrlProviderResult> {
  const base: UrlProviderResult = { provider: "URLhaus", status: "not_configured", threatTypes: [] };
  if (!authKey) return base;
  let response: Response;
  try {
    response = await fetchWithTimeout(fetcher, "https://urlhaus-api.abuse.ch/v1/url/", {
      method: "POST",
      headers: { Accept: "application/json", "Auth-Key": authKey, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ url }),
    });
  } catch (reason) {
    return { ...base, status: classifyFetchFailure(reason) };
  }

  const failedStatus = classifyFailedResponse(response, "rate_limited");
  if (failedStatus) return { ...base, status: failedStatus };

  try {
    const payload = await response.json() as { query_status?: unknown; threat?: unknown; tags?: unknown };
    if (payload.query_status === "no_results") return { ...base, status: "not_found" };
    if (payload.query_status !== "ok") return { ...base, status: "invalid_response" };
    const values = [payload.threat, ...(Array.isArray(payload.tags) ? payload.tags : [])].filter((value): value is string => typeof value === "string").slice(0, 8);
    return { ...base, status: "match", threatTypes: [...new Set(values)] };
  } catch {
    return { ...base, status: "invalid_response" };
  }
}

export async function queryMalwareBazaar(sha256: string, authKey: string | undefined, fetcher: Fetcher = fetch): Promise<MalwareProviderResult> {
  const base: MalwareProviderResult = { provider: "MalwareBazaar", status: "not_configured" };
  if (!authKey) return base;
  let response: Response;
  try {
    response = await fetchWithTimeout(fetcher, "https://mb-api.abuse.ch/api/v1/", {
      method: "POST",
      headers: { Accept: "application/json", "Auth-Key": authKey, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ query: "get_info", hash: sha256 }),
    });
  } catch (reason) {
    return { ...base, status: classifyFetchFailure(reason) };
  }

  const failedStatus = classifyFailedResponse(response, "rate_limited");
  if (failedStatus) return { ...base, status: failedStatus };

  try {
    const payload = await response.json() as { query_status?: unknown; data?: unknown };
    if (payload.query_status === "hash_not_found" || payload.query_status === "no_results") return { ...base, status: "not_found" };
    if (payload.query_status !== "ok" || !Array.isArray(payload.data) || !payload.data[0] || typeof payload.data[0] !== "object") {
      return { ...base, status: "invalid_response" };
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
    return { ...base, status: "invalid_response" };
  }
}
