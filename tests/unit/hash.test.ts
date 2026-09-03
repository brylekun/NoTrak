import { describe, expect, it } from "vitest";

import { bytesToHex, formatByteSize, hashText } from "../../lib/crypto/hash";

describe("hash helpers", () => {
  it("matches the SHA-256 known vector for abc", async () => {
    await expect(hashText("abc", "SHA-256")).resolves.toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("encodes bytes as padded lowercase hexadecimal", () => {
    expect(bytesToHex(new Uint8Array([0, 15, 16, 255]))).toBe("000f10ff");
  });

  it("formats byte sizes", () => {
    expect(formatByteSize(900)).toBe("900 B");
    expect(formatByteSize(1024)).toBe("1.00 KB");
  });
});
