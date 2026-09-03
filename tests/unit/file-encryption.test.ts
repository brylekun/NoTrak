import { describe, expect, it } from "vitest";

import {
  FILE_ENCRYPTION_VERSION,
  decryptFilePayload,
  encryptFilePayload,
  inspectEncryptedFile,
} from "../../lib/crypto/file-encryption";

const password = "correct horse battery staple";

function bytesInclude(haystack: ArrayBuffer, needle: Uint8Array<ArrayBuffer>) {
  const view = new Uint8Array(haystack);
  outer: for (let start = 0; start <= view.length - needle.length; start += 1) {
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (view[start + offset] !== needle[offset]) continue outer;
    }
    return true;
  }
  return false;
}

/**
 * Builds a legacy v1 container, which stored the original filename in the
 * cleartext header. Nothing writes this format any more, but files created
 * before v2 must keep decrypting.
 */
async function buildLegacyV1Container(plaintext: Uint8Array<ArrayBuffer>, filename: string, iterations = 100_000) {
  const encodedName = new TextEncoder().encode(filename);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const header = new Uint8Array(44 + encodedName.byteLength);
  const view = new DataView(header.buffer);
  header.set(new TextEncoder().encode("NOTRAK01"), 0);
  header[8] = 1;
  header[9] = 1;
  view.setUint32(10, iterations, false);
  header.set(salt, 14);
  header.set(iv, 30);
  view.setUint16(42, encodedName.byteLength, false);
  header.set(encodedName, 44);

  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: header, tagLength: 128 },
    key,
    plaintext,
  );

  const container = new Uint8Array(header.byteLength + ciphertext.byteLength);
  container.set(header, 0);
  container.set(new Uint8Array(ciphertext), header.byteLength);
  return container.buffer;
}

describe("NoTrak encrypted file format", () => {
  it("round-trips bytes and the original Unicode filename", async () => {
    const source = new TextEncoder().encode("private contents").buffer;
    const encrypted = await encryptFilePayload(source, "秘密.txt", password, { iterations: 100_000 });
    const decrypted = await decryptFilePayload(encrypted, password);

    expect(decrypted.filename).toBe("秘密.txt");
    expect(new TextDecoder().decode(decrypted.bytes)).toBe("private contents");
  });

  it("writes the current format version", async () => {
    const encrypted = await encryptFilePayload(new Uint8Array([1]).buffer, "a.bin", password, { iterations: 100_000 });

    expect(FILE_ENCRYPTION_VERSION).toBe(2);
    expect(inspectEncryptedFile(encrypted).version).toBe(2);
    expect(inspectEncryptedFile(encrypted).filenameWasEncrypted).toBe(true);
  });

  it("does not leave the original filename readable in the container", async () => {
    const filename = "medical-records-2025.pdf";
    const encrypted = await encryptFilePayload(new TextEncoder().encode("x".repeat(64)).buffer, filename, password, {
      iterations: 100_000,
    });

    expect(bytesInclude(encrypted, new TextEncoder().encode(filename))).toBe(false);
    expect(inspectEncryptedFile(encrypted).cleartextFilename).toBeUndefined();
    // The name still survives a real decryption.
    await expect(decryptFilePayload(encrypted, password)).resolves.toMatchObject({ filename });
  });

  it("keeps a non-ASCII filename out of the container as well", async () => {
    const filename = "医療記録.pdf";
    const encrypted = await encryptFilePayload(new Uint8Array(64).buffer, filename, password, { iterations: 100_000 });

    expect(bytesInclude(encrypted, new TextEncoder().encode(filename))).toBe(false);
  });

  it("still decrypts a legacy v1 container and reports its weaker guarantee", async () => {
    const legacy = await buildLegacyV1Container(new TextEncoder().encode("legacy contents"), "old-name.txt");
    const inspected = inspectEncryptedFile(legacy);

    expect(inspected.version).toBe(1);
    expect(inspected.filenameWasEncrypted).toBe(false);
    expect(inspected.cleartextFilename).toBe("old-name.txt");

    const decrypted = await decryptFilePayload(legacy, password);
    expect(decrypted.filename).toBe("old-name.txt");
    expect(decrypted.version).toBe(1);
    expect(decrypted.filenameWasEncrypted).toBe(false);
    expect(new TextDecoder().decode(decrypted.bytes)).toBe("legacy contents");
  });

  it("rejects a wrong password on a legacy container too", async () => {
    const legacy = await buildLegacyV1Container(new TextEncoder().encode("legacy"), "old.txt");

    await expect(decryptFilePayload(legacy, "this password is wrong")).rejects.toThrow(/Decryption failed/);
  });

  it("rejects a wrong password and corrupted authenticated data", async () => {
    const encrypted = await encryptFilePayload(new Uint8Array([1, 2, 3]).buffer, "data.bin", password, { iterations: 100_000 });
    await expect(decryptFilePayload(encrypted, "this password is wrong")).rejects.toThrow(/Decryption failed/);

    const damaged = encrypted.slice(0);
    const bytes = new Uint8Array(damaged);
    bytes[bytes.length - 1] ^= 1;
    await expect(decryptFilePayload(damaged, password)).rejects.toThrow(/damaged/);
  });

  it("detects tampering with the authenticated header", async () => {
    const encrypted = await encryptFilePayload(new Uint8Array([4, 5, 6]).buffer, "data.bin", password, { iterations: 100_000 });
    const tampered = encrypted.slice(0);
    // Flip a salt byte, which is covered by the AAD.
    new Uint8Array(tampered)[14] ^= 1;

    await expect(decryptFilePayload(tampered, password)).rejects.toThrow(/Decryption failed/);
  });

  it("uses a unique random salt and IV for every encryption", async () => {
    const source = new Uint8Array([7, 8, 9]).buffer;
    const first = inspectEncryptedFile(await encryptFilePayload(source, "a.bin", password, { iterations: 100_000 }));
    const second = inspectEncryptedFile(await encryptFilePayload(source, "a.bin", password, { iterations: 100_000 }));
    expect(first.salt).not.toEqual(second.salt);
    expect(first.iv).not.toEqual(second.iv);
  });

  it("rejects invalid headers and weak encryption passwords", async () => {
    expect(() => inspectEncryptedFile(new Uint8Array(80).buffer)).toThrow(/valid NoTrak/);
    await expect(encryptFilePayload(new Uint8Array([1]).buffer, "a", "too-short")).rejects.toThrow(/12 characters/);
  });

  it("rejects an unsupported future version", async () => {
    const encrypted = await encryptFilePayload(new Uint8Array([1]).buffer, "a.bin", password, { iterations: 100_000 });
    const future = encrypted.slice(0);
    new Uint8Array(future)[8] = 9;

    expect(() => inspectEncryptedFile(future)).toThrow(/version 9 is not supported/);
  });

  it("preserves an empty-name file by falling back to a neutral name", async () => {
    const encrypted = await encryptFilePayload(new Uint8Array([1, 2]).buffer, "", password, { iterations: 100_000 });

    await expect(decryptFilePayload(encrypted, password)).resolves.toMatchObject({ filename: "decrypted-file" });
  });
});
