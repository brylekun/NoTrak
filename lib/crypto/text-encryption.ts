import { FILE_ENCRYPTION_ITERATIONS } from "./file-encryption";

/**
 * Text encryption reuses the file container's primitives but produces a
 * copy-pasteable string. The armored form is a versioned, URL-safe Base64 blob
 * so it survives being pasted into a chat or email.
 */
const MAGIC = "NOTRAKTXT1";
const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BITS = 128;

export const MAX_PLAINTEXT_CHARACTERS = 200_000;
export const TEXT_ENCRYPTION_ITERATIONS = FILE_ENCRYPTION_ITERATIONS;

function assertPassword(password: string, encrypting: boolean) {
  if (!password) throw new Error("Enter the password for this message.");
  if (encrypting && password.length < 12) {
    throw new Error("Use a password or passphrase with at least 12 characters.");
  }
}

function toUrlSafeBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function fromUrlSafeBase64(value: string) {
  const swapped = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = swapped.length % 4 === 0 ? swapped : swapped + "=".repeat(4 - (swapped.length % 4));
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
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

export async function encryptText(plaintext: string, password: string, iterations = TEXT_ENCRYPTION_ITERATIONS) {
  assertPassword(password, true);
  if (!plaintext) throw new Error("Enter a message to encrypt.");
  if (plaintext.length > MAX_PLAINTEXT_CHARACTERS) {
    throw new Error("This message is too long. Use the file encryption tool instead.");
  }

  const salt = globalThis.crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const header = new Uint8Array(4);
  new DataView(header.buffer).setUint32(0, iterations, false);

  const key = await deriveKey(password, salt, iterations, "encrypt");
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: header, tagLength: TAG_BITS },
    key,
    new TextEncoder().encode(plaintext),
  );

  const payload = new Uint8Array(header.byteLength + salt.byteLength + iv.byteLength + ciphertext.byteLength);
  payload.set(header, 0);
  payload.set(salt, header.byteLength);
  payload.set(iv, header.byteLength + salt.byteLength);
  payload.set(new Uint8Array(ciphertext), header.byteLength + salt.byteLength + iv.byteLength);

  return `${MAGIC}.${toUrlSafeBase64(payload)}`;
}

export async function decryptText(armored: string, password: string) {
  assertPassword(password, false);

  const trimmed = armored.trim().replace(/\s+/gu, "");
  if (!trimmed.startsWith(`${MAGIC}.`)) {
    throw new Error("This does not look like a NoTrak encrypted message.");
  }

  let payload: Uint8Array;
  try {
    payload = fromUrlSafeBase64(trimmed.slice(MAGIC.length + 1));
  } catch {
    throw new Error("The encrypted message is damaged.");
  }

  if (payload.byteLength < 4 + SALT_BYTES + IV_BYTES + TAG_BITS / 8) {
    throw new Error("The encrypted message is damaged.");
  }

  const header = payload.slice(0, 4);
  const iterations = new DataView(header.buffer, header.byteOffset, 4).getUint32(0, false);
  if (iterations < 100_000 || iterations > 10_000_000) {
    throw new Error("The encrypted message has an invalid work factor.");
  }

  const salt = payload.slice(4, 4 + SALT_BYTES);
  const iv = payload.slice(4 + SALT_BYTES, 4 + SALT_BYTES + IV_BYTES);
  const ciphertext = payload.slice(4 + SALT_BYTES + IV_BYTES);

  const key = await deriveKey(password, salt, iterations, "decrypt");
  let decrypted: ArrayBuffer;
  try {
    decrypted = await globalThis.crypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: header, tagLength: TAG_BITS },
      key,
      ciphertext,
    );
  } catch {
    throw new Error("Decryption failed. Check the password and make sure the message was not altered.");
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(decrypted);
  } catch {
    throw new Error("The decrypted content is not valid text.");
  }
}
