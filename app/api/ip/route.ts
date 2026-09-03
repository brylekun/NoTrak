import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function cleanHeader(value: string | null, maxLength = 128) {
  if (!value) return null;
  const cleaned = value.trim().slice(0, maxLength);
  return cleaned || null;
}

function decodeHeader(value: string | null) {
  const cleaned = cleanHeader(value);
  if (!cleaned) return null;
  try {
    return decodeURIComponent(cleaned);
  } catch {
    return cleaned;
  }
}

function getIp(request: NextRequest) {
  const forwarded =
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip");
  const candidate = forwarded?.split(",")[0]?.trim().replace(/^::ffff:/, "") ?? null;

  if (!candidate || candidate.length > 64 || !/^[0-9a-fA-F:.]+$/.test(candidate)) return null;
  return candidate;
}

export async function GET(request: NextRequest) {
  const ip = getIp(request);

  return NextResponse.json(
    {
      ip,
      ipVersion: ip ? (ip.includes(":") ? 6 : 4) : null,
      country: cleanHeader(request.headers.get("x-vercel-ip-country"), 8),
      region: cleanHeader(request.headers.get("x-vercel-ip-country-region"), 24),
      city: decodeHeader(request.headers.get("x-vercel-ip-city")),
      timezone: cleanHeader(request.headers.get("x-vercel-ip-timezone"), 64),
    },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        Pragma: "no-cache",
      },
    },
  );
}
