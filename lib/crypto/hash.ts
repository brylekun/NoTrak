export const HASH_ALGORITHMS = ["SHA-256", "SHA-384", "SHA-512"] as const;

export type HashAlgorithm = (typeof HASH_ALGORITHMS)[number];

export function bytesToHex(bytes: ArrayBuffer | ArrayBufferView) {
  const view = bytes instanceof ArrayBuffer
    ? new Uint8Array(bytes)
    : new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  return Array.from(view, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashBytes(data: BufferSource, algorithm: HashAlgorithm) {
  const digest = await globalThis.crypto.subtle.digest(algorithm, data);
  return bytesToHex(digest);
}

export async function hashText(text: string, algorithm: HashAlgorithm) {
  return hashBytes(new TextEncoder().encode(text), algorithm);
}

export function formatByteSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;

  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = units[0];

  for (let index = 1; index < units.length && value >= 1024; index += 1) {
    value /= 1024;
    unit = units[index];
  }

  return `${value >= 10 ? value.toFixed(1) : value.toFixed(2)} ${unit}`;
}
