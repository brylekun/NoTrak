import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";

import {
  createZipArchive,
  extractZipArchive,
  inspectZipArchive,
  safeZipPath,
  uniqueZipPaths,
  validateZipSources,
  zipDownloadName,
} from "../../lib/archive/zip";

describe("ZIP Toolkit", () => {
  it("sanitizes unsafe paths and resolves duplicate names", () => {
    expect(safeZipPath("../../private\\notes?.txt")).toBe("private/notes-.txt");
    expect(uniqueZipPaths(["report.txt", "REPORT.txt", "report.txt"])).toEqual([
      "report.txt",
      "REPORT-2.txt",
      "report-3.txt",
    ]);
    expect(zipDownloadName("Quarterly files.zip")).toBe("Quarterly files.zip");
  });

  it("validates file count and size limits", () => {
    expect(validateZipSources([{ name: "one.txt", size: 3 }])).toEqual({ count: 1, total: 3 });
    expect(() => validateZipSources([])).toThrow(/at least one/i);
    expect(() => validateZipSources([{ name: "huge.bin", size: 101 * 1024 * 1024 }])).toThrow(/100 MB/);
  });

  it("creates, inspects, and extracts a standard archive", () => {
    const archive = createZipArchive([
      { name: "hello.txt", size: 5, bytes: new TextEncoder().encode("hello") },
      { name: "hello.txt", size: 5, bytes: new TextEncoder().encode("world") },
    ]);
    const summary = inspectZipArchive(archive);
    expect(summary.entries.map((entry) => entry.path)).toEqual(["hello.txt", "hello-2.txt"]);
    expect(summary.extractedBytes).toBe(10);

    const extracted = extractZipArchive(archive);
    expect(extracted.map((entry) => entry.downloadName)).toEqual(["hello.txt", "hello-2.txt"]);
    expect(new TextDecoder().decode(extracted[0].bytes)).toBe("hello");
    expect(new TextDecoder().decode(extracted[1].bytes)).toBe("world");
  });

  it("rejects malformed input before extraction", () => {
    expect(() => inspectZipArchive(new Uint8Array([1, 2, 3]))).toThrow(/complete ZIP/i);
  });

  it("normalizes traversal paths and rejects conflicting or reserved names", () => {
    const unsafe = zipSync({ "../../folder/secret.txt": new Uint8Array([1]) });
    expect(inspectZipArchive(unsafe).entries[0].path).toBe("folder/secret.txt");

    const conflicting = zipSync({ "folder/file.txt": new Uint8Array([1]), "../folder/file.txt": new Uint8Array([2]) });
    expect(() => inspectZipArchive(conflicting)).toThrow(/conflicting filenames/i);

    const reserved = zipSync({ "__proto__/payload.txt": new Uint8Array([1]) });
    expect(() => inspectZipArchive(reserved)).toThrow(/reserved or unsafe filename/i);
  });

  it("rejects encrypted flags and deceptive expanded sizes during preflight", () => {
    const encrypted = zipSync({ "file.txt": new Uint8Array([1]) });
    const encryptedView = new DataView(encrypted.buffer, encrypted.byteOffset, encrypted.byteLength);
    const centralOffset = encrypted.findIndex((_, index) => index + 3 < encrypted.length && encryptedView.getUint32(index, true) === 0x02014b50);
    encryptedView.setUint16(centralOffset + 8, encryptedView.getUint16(centralOffset + 8, true) | 1, true);
    expect(() => inspectZipArchive(encrypted)).toThrow(/Password-protected/i);

    const oversized = zipSync({ "file.txt": new Uint8Array([1]) });
    const oversizedView = new DataView(oversized.buffer, oversized.byteOffset, oversized.byteLength);
    const oversizedCentral = oversized.findIndex((_, index) => index + 3 < oversized.length && oversizedView.getUint32(index, true) === 0x02014b50);
    oversizedView.setUint32(oversizedCentral + 24, 101 * 1024 * 1024, true);
    expect(() => inspectZipArchive(oversized)).toThrow(/100 MB per-file/i);
  });
});
