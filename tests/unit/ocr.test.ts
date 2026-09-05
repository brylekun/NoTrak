import { describe, expect, it } from "vitest";

import {
  normalizeOcrCrop,
  ocrStatusLabel,
  ocrTextName,
  rotateOcrLeft,
  rotateOcrRight,
  validateOcrDimensions,
  validateOcrImage,
} from "../../lib/images/ocr";

describe("Image to Text boundaries", () => {
  it("accepts bounded browser-decodable images", () => {
    expect(() => validateOcrImage({ name: "scan.png", type: "image/png", size: 1024 })).not.toThrow();
    expect(() => validateOcrDimensions({ width: 4000, height: 3000 })).not.toThrow();
  });

  it("rejects empty, oversized, unsupported, and excessive-pixel images", () => {
    expect(() => validateOcrImage({ name: "empty.png", type: "image/png", size: 0 })).toThrow("non-empty");
    expect(() => validateOcrImage({ name: "large.png", type: "image/png", size: 16 * 1024 * 1024 })).toThrow("15 MB");
    expect(() => validateOcrImage({ name: "vector.svg", type: "image/svg+xml", size: 100 })).toThrow("JPEG, PNG, or WebP");
    expect(() => validateOcrDimensions({ width: 8000, height: 6000 })).toThrow("40 megapixels");
  });

  it("keeps a crop inside the source and rounds pixel coordinates", () => {
    expect(normalizeOcrCrop({ x: 10.4, y: 20.6, width: 300.2, height: 199.7 }, { width: 1000, height: 800 }))
      .toEqual({ x: 10, y: 21, width: 300, height: 200 });
    expect(() => normalizeOcrCrop({ x: 900, y: 0, width: 101, height: 100 }, { width: 1000, height: 800 }))
      .toThrow("inside the image");
  });

  it("rotates in quarter turns", () => {
    expect(rotateOcrRight(270)).toBe(0);
    expect(rotateOcrLeft(0)).toBe(270);
  });

  it("creates a safe text filename and readable progress wording", () => {
    expect(ocrTextName("receipt.final.png")).toBe("receipt.final-text.txt");
    expect(ocrTextName("image")).toBe("image-text.txt");
    expect(ocrStatusLabel("recognizing text")).toBe("Reading text from the image");
  });
});
