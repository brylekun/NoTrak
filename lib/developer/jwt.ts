export const MAX_JWT_CHARACTERS = 32_768;

export type DecodedJwt = {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signaturePresent: boolean;
  expiration?: { timestamp: number; expired: boolean; iso: string };
  notBefore?: { timestamp: number; active: boolean; iso: string };
};

function decodeBase64Url(segment: string) {
  if (!/^[A-Za-z0-9_-]+$/u.test(segment)) throw new Error("The token contains invalid Base64URL characters.");
  const padded = segment.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(segment.length / 4) * 4, "=");
  let binary: string;
  try { binary = atob(padded); } catch { throw new Error("The token contains invalid Base64URL data."); }
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw new Error("The token does not contain valid UTF-8 JSON."); }
}

function decodeObject(segment: string, label: string) {
  try {
    const value = JSON.parse(decodeBase64Url(segment)) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch (reason) {
    if (reason instanceof Error && reason.message.startsWith("The token")) throw reason;
    throw new Error(`The JWT ${label} is not a JSON object.`);
  }
}

function numericDate(value: unknown, nowSeconds: number, kind: "expiration" | "not-before") {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const date = new Date(value * 1000);
  if (Number.isNaN(date.getTime())) return undefined;
  return kind === "expiration"
    ? { timestamp: value, expired: value <= nowSeconds, iso: date.toISOString() }
    : { timestamp: value, active: value <= nowSeconds, iso: date.toISOString() };
}

export function decodeJwt(token: string, nowSeconds = Date.now() / 1000): DecodedJwt {
  const trimmed = token.trim();
  if (!trimmed) throw new Error("Enter a JWT to decode.");
  if (trimmed.length > MAX_JWT_CHARACTERS) throw new Error("The token is too large to decode here.");
  const parts = trimmed.split(".");
  if (parts.length !== 3 || !parts[0] || !parts[1]) throw new Error("A compact JWT must contain three dot-separated parts.");
  const header = decodeObject(parts[0], "header");
  const payload = decodeObject(parts[1], "payload");
  return {
    header,
    payload,
    signaturePresent: parts[2].length > 0,
    expiration: numericDate(payload.exp, nowSeconds, "expiration") as DecodedJwt["expiration"],
    notBefore: numericDate(payload.nbf, nowSeconds, "not-before") as DecodedJwt["notBefore"],
  };
}
