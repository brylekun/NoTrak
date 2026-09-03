const MAGIC = new TextEncoder().encode("NOTRAK01");
const KDF_PBKDF2_SHA256 = 1;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const NAME_LENGTH_BYTES = 2;
const MAX_NAME_BYTES = 1024;

// Format v1 kept the original filename in the cleartext header, so anyone
// holding a .notrak file could read it without the password. v2 moves the name
// inside the AES-GCM plaintext. v1 files are still decrypted for compatibility,
// but nothing writes v1 any more.
const VERSION_V1_CLEARTEXT_NAME = 1;
const VERSION_V2_ENCRYPTED_NAME = 2;
export const FILE_ENCRYPTION_VERSION = VERSION_V2_ENCRYPTED_NAME;

const V1_FIXED_HEADER_BYTES = 44;
const V2_HEADER_BYTES = 42;

export const FILE_ENCRYPTION_ITERATIONS = 600_000;
export const MAX_PLAINTEXT_BYTES = 100 * 1024 * 1024;
export const ENCRYPTED_FILE_EXTENSION = ".notrak";

export type DecryptedFile = {
  bytes: ArrayBuffer;
  filename: string;
  /** The format the container was written in. v1 exposed the filename. */
  version: number;
  filenameWasEncrypted: boolean;
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

function assertIterations(iterations: number) {
  if (!Number.isSafeInteger(iterations) || iterations < 100_000 || iterations > 10_000_000) {
    throw new Error("The key-derivation work factor is invalid.");
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

function encodeName(filename: string) {
  const encoded = new TextEncoder().encode(filename);
  if (encoded.byteLength > MAX_NAME_BYTES) throw new Error("The file name is too long to encrypt.");
  return encoded;
}

function makeV2Header(salt: Uint8Array<ArrayBuffer>, iv: Uint8Array<ArrayBuffer>, iterations: number) {
  const header = new Uint8Array(V2_HEADER_BYTES);
  const view = new DataView(header.buffer);
  header.set(MAGIC, 0);
  header[8] = VERSION_V2_ENCRYPTED_NAME;
  header[9] = KDF_PBKDF2_SHA256;
  view.setUint32(10, iterations, false);
  header.set(salt, 14);
  header.set(iv, 30);
  return header;
}

/** Prefixes the plaintext with its length-delimited original filename. */
function makeNamedPlaintext(filename: string, plaintext: ArrayBuffer) {
  const encodedName = encodeName(filename);
  const prefix = new Uint8Array(NAME_LENGTH_BYTES);
  new DataView(prefix.buffer).setUint16(0, encodedName.byteLength, false);
  return concatBytes(prefix, encodedName, new Uint8Array(plaintext));
}

function readNamedPlaintext(bytes: Uint8Array<ArrayBuffer>) {
  if (bytes.byteLength < NAME_LENGTH_BYTES) throw new Error("The decrypted container is damaged.");
  const nameLength = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(0, false);
  const nameEnd = NAME_LENGTH_BYTES + nameLength;
  if (nameLength > MAX_NAME_BYTES || nameEnd > bytes.byteLength) {
    throw new Error("The decrypted container is damaged.");
  }

  let filename: string;
  try {
    filename = new TextDecoder("utf-8", { fatal: true }).decode(bytes.slice(NAME_LENGTH_BYTES, nameEnd));
  } catch {
    throw new Error("The decrypted file name is damaged.");
  }

  return { filename: filename || "decrypted-file", payload: bytes.slice(nameEnd) };
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
  assertIterations(iterations);

  const salt = globalThis.crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const header = makeV2Header(salt, iv, iterations);
  const named = makeNamedPlaintext(filename || "decrypted-file", plaintext);
  const key = await deriveKey(password, salt, iterations, "encrypt");
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: header, tagLength: TAG_BYTES * 8 },
    key,
    named,
  );

  return concatBytes(header, new Uint8Array(ciphertext)).buffer;
}

export type EncryptedFileInfo = {
  version: number;
  /** Present only for legacy v1 containers, which stored it in cleartext. */
  cleartextFilename?: string;
  filenameWasEncrypted: boolean;
  iterations: number;
  salt: Uint8Array<ArrayBuffer>;
  iv: Uint8Array<ArrayBuffer>;
  header: Uint8Array<ArrayBuffer>;
  ciphertext: Uint8Array<ArrayBuffer>;
};

export function inspectEncryptedFile(payload: ArrayBuffer): EncryptedFileInfo {
  if (payload.byteLength < V2_HEADER_BYTES + TAG_BYTES) {
    throw new Error("This is not a valid NoTrak encrypted file.");
  }
  const bytes = new Uint8Array(payload);
  if (!MAGIC.every((byte, index) => bytes[index] === byte)) {
    throw new Error("This is not a valid NoTrak encrypted file.");
  }

  const version = bytes[8];
  if (version !== VERSION_V1_CLEARTEXT_NAME && version !== VERSION_V2_ENCRYPTED_NAME) {
    throw new Error(`Encrypted file version ${version} is not supported.`);
  }
  if (bytes[9] !== KDF_PBKDF2_SHA256) throw new Error("The encrypted file uses an unsupported key method.");

  const view = new DataView(payload);
  const iterations = view.getUint32(10, false);
  if (iterations < 100_000 || iterations > 10_000_000) throw new Error("The encrypted file has an invalid work factor.");

  const salt = bytes.slice(14, 30);
  const iv = bytes.slice(30, 42);

  if (version === VERSION_V2_ENCRYPTED_NAME) {
    return {
      version,
      filenameWasEncrypted: true,
      iterations,
      salt,
      iv,
      header: bytes.slice(0, V2_HEADER_BYTES),
      ciphertext: bytes.slice(V2_HEADER_BYTES),
    };
  }

  if (payload.byteLength < V1_FIXED_HEADER_BYTES + TAG_BYTES) {
    throw new Error("The encrypted file header is damaged.");
  }
  const nameLength = view.getUint16(42, false);
  const headerLength = V1_FIXED_HEADER_BYTES + nameLength;
  if (nameLength > MAX_NAME_BYTES || headerLength + TAG_BYTES > payload.byteLength) {
    throw new Error("The encrypted file header is damaged.");
  }

  let cleartextFilename: string;
  try {
    cleartextFilename = new TextDecoder("utf-8", { fatal: true }).decode(bytes.slice(V1_FIXED_HEADER_BYTES, headerLength));
  } catch {
    throw new Error("The encrypted file name is damaged.");
  }

  return {
    version,
    cleartextFilename: cleartextFilename || "decrypted-file",
    filenameWasEncrypted: false,
    iterations,
    salt,
    iv,
    header: bytes.slice(0, headerLength),
    ciphertext: bytes.slice(headerLength),
  };
}

export async function decryptFilePayload(payload: ArrayBuffer, password: string): Promise<DecryptedFile> {
  assertPassword(password, false);
  const parsed = inspectEncryptedFile(payload);
  const key = await deriveKey(password, parsed.salt, parsed.iterations, "decrypt");

  let decrypted: ArrayBuffer;
  try {
    decrypted = await globalThis.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: parsed.iv, additionalData: parsed.header, tagLength: TAG_BYTES * 8 },
      key,
      parsed.ciphertext,
    );
  } catch {
    throw new Error("Decryption failed. Check the password and make sure the file is not damaged.");
  }

  const { filename, bytes } = parsed.filenameWasEncrypted
    ? (() => {
        const read = readNamedPlaintext(new Uint8Array(decrypted));
        return { filename: read.filename, bytes: read.payload.slice().buffer };
      })()
    : { filename: parsed.cleartextFilename ?? "decrypted-file", bytes: decrypted };

  if (bytes.byteLength > MAX_PLAINTEXT_BYTES) throw new Error("The decrypted file exceeds the 100 MB limit.");

  return { bytes, filename, version: parsed.version, filenameWasEncrypted: parsed.filenameWasEncrypted };
}

export function encryptedFilename(filename: string) {
  return `${filename || "file"}${ENCRYPTED_FILE_EXTENSION}`;
}
