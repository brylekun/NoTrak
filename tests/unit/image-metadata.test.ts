import { describe, expect, it } from "vitest";

import { detectImageMetadata, hasImageMetadata } from "../../lib/images/metadata";

function bytes(...parts: (number | number[] | string)[]) {
  const flat: number[] = [];
  for (const part of parts) {
    if (typeof part === "string") for (const char of part) flat.push(char.charCodeAt(0));
    else if (Array.isArray(part)) flat.push(...part);
    else flat.push(part);
  }
  return new Uint8Array(flat).buffer;
}

function be16(value: number) {
  return [(value >> 8) & 0xff, value & 0xff];
}

function be32(value: number) {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function le32(value: number) {
  return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff];
}

/** JPEG: SOI, then one APP/COM segment, then SOS. */
function jpeg(marker: number, payload: string, extra: number[] = []) {
  const body = [...payload].map((char) => char.charCodeAt(0)).concat(extra);
  return bytes(
    [0xff, 0xd8],
    [0xff, marker],
    be16(body.length + 2),
    body,
    [0xff, 0xda, 0x00, 0x02],
  );
}

function png(chunkType: string, payload: string) {
  const body = [...payload].map((char) => char.charCodeAt(0));
  return bytes(
    [0x89],
    "PNG",
    [0x0d, 0x0a, 0x1a, 0x0a],
    be32(body.length),
    chunkType,
    body,
    be32(0),
    be32(0),
    "IEND",
    be32(0),
  );
}

function webp(chunkType: string, payload: string) {
  const body = [...payload].map((char) => char.charCodeAt(0));
  const padded = body.length % 2 === 1 ? [...body, 0] : body;
  return bytes("RIFF", le32(4 + 8 + padded.length), "WEBP", chunkType, le32(body.length), padded);
}

describe("detectImageMetadata", () => {
  it("finds EXIF in a JPEG APP1 segment", () => {
    const findings = detectImageMetadata(jpeg(0xe1, "Exif\0\0", [0x4d, 0x4d]));

    expect(findings.map((finding) => finding.container)).toEqual(["exif"]);
    expect(findings[0].label).toMatch(/GPS/);
  });

  it("finds XMP in a JPEG APP1 segment", () => {
    expect(detectImageMetadata(jpeg(0xe1, "http://ns.adobe.com/xap/1.0/\0")).map((f) => f.container)).toEqual(["xmp"]);
  });

  it("finds an ICC profile and a JPEG comment", () => {
    expect(detectImageMetadata(jpeg(0xe2, "ICC_PROFILE\0")).map((f) => f.container)).toEqual(["icc"]);
    expect(detectImageMetadata(jpeg(0xfe, "shot on a phone")).map((f) => f.container)).toEqual(["comment"]);
  });

  it("finds IPTC in a Photoshop APP13 segment", () => {
    expect(detectImageMetadata(jpeg(0xed, "Photoshop 3.0\0")).map((f) => f.container)).toEqual(["iptc"]);
  });

  it("reports nothing for a JPEG carrying no metadata segment", () => {
    expect(detectImageMetadata(bytes([0xff, 0xd8], [0xff, 0xda, 0x00, 0x02]))).toEqual([]);
  });

  it("does not report EXIF for bytes that merely appear in the scan data", () => {
    // "Exif\0\0" after the start-of-scan marker must be ignored: a raw byte scan
    // would have matched it.
    const withScanText = bytes([0xff, 0xd8], [0xff, 0xda, 0x00, 0x02], "Exif\0\0");

    expect(hasImageMetadata(withScanText)).toBe(false);
  });

  it("finds PNG text chunks that the old EXIF-only check missed", () => {
    expect(detectImageMetadata(png("tEXt", "Comment\0taken at home")).map((f) => f.container)).toEqual(["png-text"]);
    expect(detectImageMetadata(png("zTXt", "Comment\0")).map((f) => f.container)).toEqual(["png-text"]);
  });

  it("finds an XMP packet inside a PNG iTXt chunk", () => {
    const findings = detectImageMetadata(png("iTXt", "XML:com.adobe.xmp\0")).map((f) => f.container);

    expect(findings).toContain("png-text");
    expect(findings).toContain("xmp");
  });

  it("finds a PNG eXIf chunk and an embedded ICC profile", () => {
    expect(detectImageMetadata(png("eXIf", "MM")).map((f) => f.container)).toEqual(["png-exif"]);
    expect(detectImageMetadata(png("iCCP", "sRGB\0")).map((f) => f.container)).toEqual(["icc"]);
  });

  it("reports nothing for a PNG with only image chunks", () => {
    expect(detectImageMetadata(png("IHDR", "not metadata"))).toEqual([]);
  });

  it("finds WebP EXIF and XMP chunks", () => {
    expect(detectImageMetadata(webp("EXIF", "MM")).map((f) => f.container)).toEqual(["webp-exif"]);
    expect(detectImageMetadata(webp("XMP ", "<x:xmpmeta")).map((f) => f.container)).toEqual(["webp-xmp"]);
  });

  it("reports nothing for a WebP with only image data", () => {
    expect(detectImageMetadata(webp("VP8 ", "pixels"))).toEqual([]);
  });

  it("reports nothing for an unrecognized container", () => {
    expect(detectImageMetadata(bytes("not an image at all"))).toEqual([]);
    expect(detectImageMetadata(new ArrayBuffer(0))).toEqual([]);
  });

  it("does not run past the end of a truncated file", () => {
    expect(() => detectImageMetadata(bytes([0xff, 0xd8], [0xff, 0xe1, 0xff, 0xff]))).not.toThrow();
    expect(() => detectImageMetadata(bytes([0x89], "PNG", [0x0d, 0x0a, 0x1a, 0x0a], be32(9999), "tEXt"))).not.toThrow();
    expect(() => detectImageMetadata(bytes("RIFF", le32(9999), "WEBP", "EXIF", le32(9999)))).not.toThrow();
  });
});
