import { describe, expect, it } from "vitest";

import {
  formatMbps,
  formatMilliseconds,
  latencyJitter,
  medianPositiveMeasurement,
  positiveEstimate,
  speedTestStage,
} from "../../lib/network/speed";

describe("speed result formatting", () => {
  it("formats bandwidth and latency values", () => {
    expect(formatMbps(87_650_000)).toBe("87.7");
    expect(formatMbps(undefined)).toBe("—");
    expect(formatMilliseconds(8.75)).toBe("8.8");
    expect(formatMilliseconds(42.4)).toBe("42");
    expect(formatMilliseconds(undefined)).toBe("—");
  });

  it("rejects estimates without enough valid samples", () => {
    expect(positiveEstimate(120_000_000, [110_000_000, 125_000_000], 3)).toBeUndefined();
    expect(positiveEstimate(120_000_000, [110_000_000, 125_000_000, 120_000_000], 3)).toBe(120_000_000);
    expect(positiveEstimate(0, [1, 2, 3], 3)).toBeUndefined();
  });

  it("calculates latency only from positive measurements", () => {
    expect(medianPositiveMeasurement([0, 12, 8, 10, Number.NaN], 3)).toBe(10);
    expect(medianPositiveMeasurement([8, 12, 10, 14], 4)).toBe(11);
    expect(medianPositiveMeasurement([0, 12], 2)).toBeUndefined();
    expect(latencyJitter([0, 10, 14, 11], 3)).toBe(3.5);
    expect(latencyJitter([0, 10], 2)).toBeUndefined();
  });

  it("labels measurement stages", () => {
    expect(speedTestStage("download")).toMatch(/download/);
    expect(speedTestStage("upload")).toMatch(/upload/);
    expect(speedTestStage("latency")).toMatch(/latency/);
  });
});
