export type UuidOptions = {
  count: number;
  uppercase: boolean;
  hyphens: boolean;
};

function uuidV4Fallback() {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

export function generateUuid() {
  return typeof globalThis.crypto.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : uuidV4Fallback();
}

export function generateUuids(options: UuidOptions) {
  if (!Number.isSafeInteger(options.count) || options.count < 1 || options.count > 100) {
    throw new Error("Generate between 1 and 100 UUIDs at a time.");
  }

  return Array.from({ length: options.count }, () => {
    let value = generateUuid();
    if (!options.hyphens) value = value.replaceAll("-", "");
    return options.uppercase ? value.toUpperCase() : value;
  });
}
