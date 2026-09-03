import { z } from "zod";

import type { SecurityApiErrorCode } from "./client";

export const urlLookupSchema = z.object({ url: z.string().trim().min(1).max(2048) }).strict();
export const hashLookupSchema = z.object({ sha256: z.string().regex(/^[a-f0-9]{64}$/u) }).strict();

const MAX_BODY_BYTES = 4096;
const WINDOW_MS = 60_000;
const WINDOW_LIMIT = 120;

// This counter is module-scoped, so on a serverless platform each warm instance
// keeps its own window and the effective ceiling scales with concurrency. It is
// a courtesy brake that protects a single instance from a runaway client and
// keeps provider quota burn bounded per instance -- it is NOT the abuse control.
// Edge rate limiting (Vercel Firewall) is the enforced limit; see
// RELEASE_CHECKLIST.md.
let windowStartedAt = 0;
let windowRequests = 0;

export async function readBoundedJson(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) throw new Error("body_too_large");

  const reader = request.body?.getReader();
  if (!reader) throw new Error("invalid_json");
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new Error("body_too_large");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new Error("invalid_json");
  }
}

export function consumeGlobalRateLimit(now = Date.now()) {
  if (now - windowStartedAt >= WINDOW_MS) {
    windowStartedAt = now;
    windowRequests = 0;
  }
  windowRequests += 1;
  return windowRequests <= WINDOW_LIMIT;
}

export const privateResponseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
};

export function apiError(
  message: string,
  status: number,
  code: SecurityApiErrorCode = "request_failed",
  headers: HeadersInit = {},
) {
  return Response.json(
    { error: message, code },
    { status, headers: { ...privateResponseHeaders, ...Object.fromEntries(new Headers(headers)) } },
  );
}
