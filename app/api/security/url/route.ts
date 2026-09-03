import { analyzeUrlLocally, mergeProviderRisk } from "../../../../lib/security/url-risk";
import { apiError, consumeGlobalRateLimit, privateResponseHeaders, readBoundedJson, urlLookupSchema } from "../../../../lib/security/api";
import { queryGoogleSafeBrowsing, queryUrlhaus } from "../../../../lib/security/providers";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function POST(request: Request) {
  if (!consumeGlobalRateLimit()) return apiError("Too many checks are running. Try again in a minute.", 429);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return apiError("Send a JSON request.", 415);
  }

  try {
    const parsed = urlLookupSchema.safeParse(await readBoundedJson(request));
    if (!parsed.success) return apiError("Enter one complete HTTP or HTTPS URL under 2,048 characters.", 400);
    const local = analyzeUrlLocally(parsed.data.url);
    const providers = await Promise.all([
      queryGoogleSafeBrowsing(local.normalizedUrl, process.env.GOOGLE_SAFE_BROWSING_API_KEY),
      queryUrlhaus(local.normalizedUrl, process.env.URLHAUS_AUTH_KEY),
    ]);
    const reputationMatch = providers.some((provider) => provider.status === "match");
    const risk = mergeProviderRisk(local, reputationMatch);

    return Response.json(
      {
        local: { hostname: local.hostname, score: local.score, level: local.level, signals: local.signals },
        providers,
        risk,
        checkedAt: new Date().toISOString(),
        warning: reputationMatch
          ? "One or more providers reported a known threat. Do not open the link."
          : "No match does not prove that a link is safe. New and targeted threats may be unknown.",
      },
      { headers: privateResponseHeaders },
    );
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "The request could not be processed.";
    if (message === "body_too_large") return apiError("The request body is too large.", 413);
    if (message === "invalid_json") return apiError("The request body is not valid JSON.", 400);
    return apiError(message, 400);
  }
}
