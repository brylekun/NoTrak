import { describe, expect, it } from "vitest";

import { decryptFilePayload, encryptFilePayload, inspectEncryptedFile } from "../../lib/crypto/file-encryption";

const password = "correct horse battery staple";

describe("NoTrak encrypted file format", () => {
  it("round-trips bytes and the original Unicode filename", async () => {
    const source = new TextEncoder().encode("private contents").buffer;
    const encrypted = await encryptFilePayload(source, "秘密.txt", password, { iterations: 100_000 });
    const decrypted = await decryptFilePayload(encrypted, password);

    expect(decrypted.filename).toBe("秘密.txt");
    expect(new TextDecoder().decode(decrypted.bytes)).toBe("private contents");
  });

  it("rejects a wrong password and corrupted authenticated data", async () => {
    const encrypted = await encryptFilePayload(new Uint8Array([1, 2, 3]).buffer, "data.bin", password, { iterations: 100_000 });
    await expect(decryptFilePayload(encrypted, "this password is wrong")).rejects.toThrow(/Decryption failed/);

    const damaged = encrypted.slice(0);
    const bytes = new Uint8Array(damaged);
    bytes[bytes.length - 1] ^= 1;
    await expect(decryptFilePayload(damaged, password)).rejects.toThrow(/damaged/);
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
});
