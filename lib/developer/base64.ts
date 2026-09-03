export type Base64Variant = "standard" | "urlsafe";

export const MAX_ENCODE_CHARACTERS = 5_000_000;

function assertLength(value: string) {
  if (value.length > MAX_ENCODE_CHARACTERS) {
    throw new Error("The input is too large for this tool. Use the file tools for anything bigger.");
  }
}

function toUrlSafe(base64: string, stripPadding: boolean) {
  const swapped = base64.replaceAll("+", "-").replaceAll("/", "_");
  return stripPadding ? swapped.replace(/=+$/u, "") : swapped;
}

function fromUrlSafe(value: string) {
  const swapped = value.replaceAll("-", "+").replaceAll("_", "/");
  // Restore the padding a URL-safe encoder may have stripped.
  const remainder = swapped.length % 4;
  if (remainder === 1) throw new Error("This is not valid Base64: the length is impossible.");
  return remainder === 0 ? swapped : swapped + "=".repeat(4 - remainder);
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  // Chunked so a large input does not exceed the argument limit of String.fromCharCode.
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/** Encodes text as Base64 via UTF-8, so non-ASCII input round-trips. */
export function encodeBase64(text: string, variant: Base64Variant = "standard", stripPadding = false) {
  assertLength(text);
  const base64 = bytesToBase64(new TextEncoder().encode(text));
  return variant === "urlsafe" ? toUrlSafe(base64, stripPadding) : base64;
}

export function decodeBase64(value: string) {
  const trimmed = value.trim().replace(/\s+/gu, "");
  if (!trimmed) throw new Error("Paste a Base64 value to decode.");
  assertLength(trimmed);

  if (!/^[A-Za-z0-9+/\-_]*={0,2}$/u.test(trimmed)) {
    throw new Error("This contains characters that are not valid in Base64.");
  }

  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(fromUrlSafe(trimmed));
  } catch (reason) {
    if (reason instanceof Error && reason.message.startsWith("This is not valid Base64")) throw reason;
    throw new Error("This is not valid Base64.");
  }

  try {
    // Fatal decoding so binary data is reported rather than shown as U+FFFD soup.
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("This decodes to binary data, not text. Use the file tools for binary content.");
  }
}

export function encodeBase64Bytes(bytes: ArrayBuffer, variant: Base64Variant = "standard") {
  const base64 = bytesToBase64(new Uint8Array(bytes));
  return variant === "urlsafe" ? toUrlSafe(base64, true) : base64;
}
