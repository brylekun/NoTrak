import { describe, expect, it } from "vitest";

import { fitDimensions, outputImageName } from "../../lib/images/process";

describe("image processing helpers", () => {
  it("fits dimensions without enlarging", () => {
    expect(fitDimensions(4000, 2000, 1200, 1200)).toEqual({ width: 1200, height: 600 });
    expect(fitDimensions(400, 200, 1200, 1200)).toEqual({ width: 400, height: 200 });
  });

  it("creates a safe output name", () => {
    expect(outputImageName("holiday.photo.jpeg", "clean", "image/png")).toBe("holiday.photo-clean.png");
  });
});
