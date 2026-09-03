import { describe, expect, it } from "vitest";

import { MAX_PLAINTEXT_CHARACTERS, decryptText, encryptText } from "../../lib/crypto/text-encryption";

const password = "correct horse battery staple";
const fast = 100_000;

describe("text encryption", () => {
  it("round-trips a message", async () => {
    const armored = await encryptText("meet at the usual place", password, fast);

    await expect(decryptText(armored, password)).resolves.toBe("meet at the usual place");
  });

  it("round-trips Unicode and newlines", async () => {
    const message = "秘密\nrésumé — 🔐\ttab";
    const armored = await encryptText(message, password, fast);

    await expect(decryptText(armored, password)).resolves.toBe(message);
  });

  it("produces a prefixed, URL-safe block that survives being pasted", async () => {
    const armored = await encryptText("hello", password, fast);

    expect(armored.startsWith("NOTRAKTXT1.")).toBe(true);
    expect(armored.slice("NOTRAKTXT1.".length)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("tolerates whitespace introduced by copy and paste", async () => {
    const armored = await encryptText("hello", password, fast);
    const mangled = `  ${armored.slice(0, 20)}\n${armored.slice(20)}  `;

    await expect(decryptText(mangled, password)).resolves.toBe("hello");
  });

  it("never leaves the plaintext readable in the armored output", async () => {
    const armored = await encryptText("attack at dawn", password, fast);

    expect(armored).not.toContain("attack");
    expect(atob(armored.slice("NOTRAKTXT1.".length).replaceAll("-", "+").replaceAll("_", "/") + "=")).not.toContain("attack");
  });

  it("uses a fresh salt and IV for every message", async () => {
    const first = await encryptText("same message", password, fast);
    const second = await encryptText("same message", password, fast);

    expect(first).not.toBe(second);
  });

  it("rejects a wrong password", async () => {
    const armored = await encryptText("secret", password, fast);

    await expect(decryptText(armored, "wrong password here")).rejects.toThrow(/Decryption failed/);
  });

  it("rejects an altered message", async () => {
    const armored = await encryptText("secret", password, fast);
    const altered = `${armored.slice(0, -2)}${armored.at(-2) === "A" ? "B" : "A"}${armored.at(-1)}`;

    await expect(decryptText(altered, password)).rejects.toThrow(/Decryption failed|damaged/);
  });

  it("rejects a message whose work factor was tampered with", async () => {
    const armored = await encryptText("secret", password, fast);
    const body = armored.slice("NOTRAKTXT1.".length);
    const padded = body + "=".repeat((4 - (body.length % 4)) % 4);
    const bytes = Uint8Array.from(atob(padded.replaceAll("-", "+").replaceAll("_", "/")), (c) => c.charCodeAt(0));

    // Rewrite the four-byte iteration count to something out of range.
    new DataView(bytes.buffer).setUint32(0, 10, false);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const rebuilt = btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");

    await expect(decryptText(`NOTRAKTXT1.${rebuilt}`, password)).rejects.toThrow(/work factor/i);
  });

  it("rejects input that is not a NoTrak message", async () => {
    await expect(decryptText("just some text", password)).rejects.toThrow(/does not look like/i);
    await expect(decryptText("", password)).rejects.toThrow(/does not look like/i);
  });

  it("rejects a truncated message", async () => {
    await expect(decryptText("NOTRAKTXT1.AAAA", password)).rejects.toThrow(/damaged/i);
  });

  it("requires a password of at least 12 characters to encrypt", async () => {
    await expect(encryptText("hello", "too-short", fast)).rejects.toThrow(/12 characters/);
  });

  it("does not impose the length minimum when decrypting", async () => {
    // A message encrypted elsewhere may use a shorter password; the failure
    // should be an authentication failure, not a validation refusal.
    const armored = await encryptText("hello", password, fast);

    await expect(decryptText(armored, "short")).rejects.toThrow(/Decryption failed/);
  });

  it("requires a message and a password", async () => {
    await expect(encryptText("", password, fast)).rejects.toThrow(/message to encrypt/i);
    await expect(encryptText("hello", "", fast)).rejects.toThrow(/Enter the password/i);
  });

  it("rejects a message beyond the length limit", async () => {
    await expect(encryptText("x".repeat(MAX_PLAINTEXT_CHARACTERS + 1), password, fast)).rejects.toThrow(/too long/i);
  });
});
