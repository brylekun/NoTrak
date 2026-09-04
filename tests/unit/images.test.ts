import { describe, expect, it } from "vitest";

import { fitDimensions, outputImageName, resolveImageDimensions } from "../../lib/images/process";
import {
  linkedResizeDimensions,
  scaledResizeDimensions,
  validateResizeDimensions,
} from "../../lib/images/resize";

describe("image processing helpers", () => {
  it("fits dimensions without enlarging", () => {
    expect(fitDimensions(4000, 2000, 1200, 1200)).toEqual({ width: 1200, height: 600 });
    expect(fitDimensions(400, 200, 1200, 1200)).toEqual({ width: 400, height: 200 });
  });

  it("creates a safe output name", () => {
    expect(outputImageName("holiday.photo.jpeg", "clean", "image/png")).toBe("holiday.photo-clean.png");
  });

  it("uses exact target dimensions when both are supplied", () => {
    expect(resolveImageDimensions(4000, 2000, { targetWidth: 900, targetHeight: 700 })).toEqual({
      width: 900,
      height: 700,
    });
    expect(() => resolveImageDimensions(4000, 2000, { targetWidth: 900 })).toThrow("positive whole numbers");
  });

  it("keeps the original aspect ratio from either changed axis", () => {
    expect(linkedResizeDimensions({ width: 4000, height: 2000 }, "width", 1000)).toEqual({
      width: 1000,
      height: 500,
    });
    expect(linkedResizeDimensions({ width: 4000, height: 2000 }, "height", 750)).toEqual({
      width: 1500,
      height: 750,
    });
  });

  it("scales dimensions by a percentage", () => {
    expect(scaledResizeDimensions({ width: 1920, height: 1080 }, 50)).toEqual({ width: 960, height: 540 });
  });

  it("rejects unsafe or invalid resize dimensions", () => {
    expect(validateResizeDimensions(1200, 800)).toEqual({ width: 1200, height: 800 });
    expect(() => validateResizeDimensions(0, 800)).toThrow("positive whole numbers");
    expect(() => validateResizeDimensions(12_001, 800)).toThrow("12,000");
    expect(() => validateResizeDimensions(8000, 8000)).toThrow("40 megapixels");
  });
});
