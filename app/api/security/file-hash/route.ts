import { apiError, consumeGlobalRateLimit, hashLookupSchema, privateResponseHeaders, readBoundedJson } from "../../../../lib/security/api";
import { queryMalwareBazaar } from "../../../../lib/security/providers";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function POST(request: Request) {
  if (!consumeGlobalRateLimit()) return apiError("Too many checks are running. Try again in a minute.", 429);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return apiError("Send a JSON request.", 415);
  }

  try {
    const parsed = hashLookupSchema.safeParse(await readBoundedJson(request));
    if (!parsed.success) return apiError("Enter exactly one lowercase SHA-256 hash.", 400);
    const result = await queryMalwareBazaar(parsed.data.sha256, process.env.MALWAREBAZAAR_API_KEY);
    return Response.json(
      {
        ...result,
        checkedAt: new Date().toISOString(),
        fileUploaded: false,
        dataSent: "SHA-256 hash only",
        warning: result.status === "known_malicious"
          ? "MalwareBazaar recognizes this hash as malware. Isolate the file and follow your incident-response process."
          : "Unknown or not found does not mean the file is safe.",
      },
      { headers: privateResponseHeaders },
    );
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "The request could not be processed.";
    if (message === "body_too_large") return apiError("The request body is too large.", 413);
    if (message === "invalid_json") return apiError("The request body is not valid JSON.", 400);
    return apiError("The request could not be processed.", 400);
  }
}
