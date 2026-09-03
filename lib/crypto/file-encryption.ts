const MAGIC = new TextEncoder().encode("NOTRAK01");
const VERSION = 1;
const KDF_PBKDF2_SHA256 = 1;
const FIXED_HEADER_BYTES = 44;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;

export const FILE_ENCRYPTION_ITERATIONS = 600_000;
export const MAX_PLAINTEXT_BYTES = 100 * 1024 * 1024;
export const ENCRYPTED_FILE_EXTENSION = ".notrak";

export type DecryptedFile = {
  bytes: ArrayBuffer;
  filename: string;
};

type EncryptOptions = {
  iterations?: number;
};

function assertPassword(password: string, encrypting: boolean) {
  if (!password) throw new Error("Enter the password for this file.");
  if (encrypting && password.length < 12) {
    throw new Error("Use a password or passphrase with at least 12 characters.");
  }
  if (new TextEncoder().encode(password).byteLength > 1024) {
    throw new Error("The password is too long.");
  }
}

function concatBytes(...parts: Uint8Array[]) {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number, usage: KeyUsage) {
  const material = await globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return globalThis.crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    [usage],
  );
}

function makeHeader(
  filename: string,
  salt: Uint8Array<ArrayBuffer>,
  iv: Uint8Array<ArrayBuffer>,
  iterations: number,
) {
  const encodedName = new TextEncoder().encode(filename);
  if (encodedName.byteLength > 1024) throw new Error("The file name is too long to encrypt.");

  const header = new Uint8Array(FIXED_HEADER_BYTES + encodedName.byteLength);
  const view = new DataView(header.buffer);
  header.set(MAGIC, 0);
  header[8] = VERSION;
  header[9] = KDF_PBKDF2_SHA256;
  view.setUint32(10, iterations, false);
  header.set(salt, 14);
  header.set(iv, 30);
  view.setUint16(42, encodedName.byteLength, false);
  header.set(encodedName, FIXED_HEADER_BYTES);
  return header;
}

export async function encryptFilePayload(
  plaintext: ArrayBuffer,
  filename: string,
  password: string,
  options: EncryptOptions = {},
) {
  assertPassword(password, true);
  if (plaintext.byteLength === 0) throw new Error("The selected file is empty.");
  if (plaintext.byteLength > MAX_PLAINTEXT_BYTES) throw new Error("Choose a file no larger than 100 MB.");

  const iterations = options.iterations ?? FILE_ENCRYPTION_ITERATIONS;
  if (!Number.isSafeInteger(iterations) || iterations < 100_000 || iterations > 10_000_000) {
    throw new Error("The key-derivation work factor is invalid.");
  }

  const salt = globalThis.crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const header = makeHeader(filename || "decrypted-file", salt, iv, iterations);
  const key = await deriveKey(password, salt, iterations, "encrypt");
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: header, tagLength: TAG_BYTES * 8 },
    key,
    plaintext,
  );

  return concatBytes(header, new Uint8Array(ciphertext)).buffer;
}

export function inspectEncryptedFile(payload: ArrayBuffer) {
  if (payload.byteLength < FIXED_HEADER_BYTES + TAG_BYTES) {
    throw new Error("This is not a valid NoTrak encrypted file.");
  }
  const bytes = new Uint8Array(payload);
  if (!MAGIC.every((byte, index) => bytes[index] === byte)) {
    throw new Error("This is not a valid NoTrak encrypted file.");
  }
  if (bytes[8] !== VERSION) throw new Error(`Encrypted file version ${bytes[8]} is not supported.`);
  if (bytes[9] !== KDF_PBKDF2_SHA256) throw new Error("The encrypted file uses an unsupported key method.");

  const view = new DataView(payload);
  const iterations = view.getUint32(10, false);
  if (iterations < 100_000 || iterations > 10_000_000) throw new Error("The encrypted file has an invalid work factor.");
  const nameLength = view.getUint16(42, false);
  const headerLength = FIXED_HEADER_BYTES + nameLength;
  if (nameLength > 1024 || headerLength + TAG_BYTES > payload.byteLength) {
    throw new Error("The encrypted file header is damaged.");
  }

  let filename: string;
  try {
    filename = new TextDecoder("utf-8", { fatal: true }).decode(bytes.slice(FIXED_HEADER_BYTES, headerLength));
  } catch {
    throw new Error("The encrypted file name is damaged.");
  }

  return {
    filename: filename || "decrypted-file",
    iterations,
    salt: bytes.slice(14, 30),
    iv: bytes.slice(30, 42),
    header: bytes.slice(0, headerLength),
    ciphertext: bytes.slice(headerLength),
  };
}

export async function decryptFilePayload(payload: ArrayBuffer, password: string): Promise<DecryptedFile> {
  assertPassword(password, false);
  const parsed = inspectEncryptedFile(payload);
  const key = await deriveKey(password, parsed.salt, parsed.iterations, "decrypt");

  try {
    const bytes = await globalThis.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: parsed.iv, additionalData: parsed.header, tagLength: TAG_BYTES * 8 },
      key,
      parsed.ciphertext,
    );
    if (bytes.byteLength > MAX_PLAINTEXT_BYTES) throw new Error("The decrypted file exceeds the 100 MB limit.");
    return { bytes, filename: parsed.filename };
  } catch (reason) {
    if (reason instanceof Error && reason.message.includes("100 MB")) throw reason;
    throw new Error("Decryption failed. Check the password and make sure the file is not damaged.");
  }
}

export function encryptedFilename(filename: string) {
  return `${filename || "file"}${ENCRYPTED_FILE_EXTENSION}`;
}
