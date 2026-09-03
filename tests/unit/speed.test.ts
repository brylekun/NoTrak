import { describe, expect, it } from "vitest";

import {
  assessSpeedQuality,
  filterLatencyOutliers,
  formatMbps,
  formatMilliseconds,
  latencyJitter,
  medianPositiveMeasurement,
  positiveEstimate,
  relativeSpread,
  speedQualityLabel,
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

  it("removes browser timing outliers while preserving sample order", () => {
    expect(filterLatencyOutliers([20, 22, 21, 350, 19, 20, 18])).toEqual([20, 22, 21, 19, 20, 18]);
    expect(filterLatencyOutliers([0, Number.NaN, 10])).toEqual([10]);
  });

  it("labels measurement stages", () => {
    expect(speedTestStage("download")).toMatch(/download/);
    expect(speedTestStage("upload")).toMatch(/upload/);
    expect(speedTestStage("latency")).toMatch(/latency/);
  });
});

describe("relativeSpread", () => {
  it("returns undefined below four samples", () => {
    expect(relativeSpread([100, 100, 100])).toBeUndefined();
    expect(relativeSpread([])).toBeUndefined();
  });

  it("is zero for identical samples", () => {
    expect(relativeSpread([50, 50, 50, 50, 50])).toBe(0);
  });

  it("grows as samples disagree", () => {
    const tight = relativeSpread([98, 99, 100, 101, 102])!;
    const loose = relativeSpread([20, 60, 100, 140, 180])!;

    expect(tight).toBeLessThan(loose);
    expect(tight).toBeGreaterThanOrEqual(0);
  });

  it("ignores zero and negative readings", () => {
    expect(relativeSpread([0, -5, 100, 100, 100, 100])).toBe(0);
  });
});

describe("assessSpeedQuality", () => {
  const steady = [100, 101, 99, 100, 100];
  const complete = {
    summary: { download: 1, upload: 1, latency: 10, jitter: 1, downLoadedLatency: 12, upLoadedLatency: 13 },
    downloadSamples: steady,
    uploadSamples: steady,
    latencySamples: steady,
    measurementErrors: 0,
  };

  it("reports a complete measurement when every value arrived consistently", () => {
    const quality = assessSpeedQuality(complete);

    expect(quality.level).toBe("complete");
    expect(quality.reasons.join(" ")).toMatch(/estimates/i);
  });

  it("never claims laboratory precision", () => {
    expect(assessSpeedQuality(complete).reasons.join(" ")).not.toMatch(/exact|precise|accurate/i);
  });

  it("reports partial when a value is missing and names it", () => {
    const quality = assessSpeedQuality({ ...complete, summary: { ...complete.summary, upload: undefined } });

    expect(quality.level).toBe("partial");
    expect(quality.reasons.join(" ")).toContain("upload speed");
  });

  it("lists every missing value", () => {
    const quality = assessSpeedQuality({
      ...complete,
      summary: { download: undefined, upload: undefined, latency: 10, jitter: 1, downLoadedLatency: 1, upLoadedLatency: 1 },
    });

    expect(quality.reasons.join(" ")).toContain("download speed, upload speed");
  });

  it("reports partial when the engine reported a failed measurement", () => {
    const quality = assessSpeedQuality({ ...complete, measurementErrors: 2 });

    expect(quality.level).toBe("partial");
    expect(quality.reasons.join(" ")).toContain("2 measurements");
  });

  it("uses singular wording for one failed measurement", () => {
    expect(assessSpeedQuality({ ...complete, measurementErrors: 1 }).reasons.join(" ")).toContain("1 measurement could");
  });

  it("prefers partial over variable when both apply", () => {
    const quality = assessSpeedQuality({
      ...complete,
      summary: { ...complete.summary, download: undefined },
      downloadSamples: [10, 200, 30, 400, 15],
    });

    expect(quality.level).toBe("partial");
  });

  it("flags a variable download without withholding the numbers", () => {
    const quality = assessSpeedQuality({ ...complete, downloadSamples: [10, 200, 30, 400, 15, 350] });

    expect(quality.level).toBe("variable");
    expect(quality.reasons.join(" ")).toMatch(/download samples varied/i);
    expect(quality.reasons.join(" ")).toMatch(/again|repeat/i);
  });

  it("flags a variable upload and unstable latency separately", () => {
    const upload = assessSpeedQuality({ ...complete, uploadSamples: [5, 90, 12, 140, 8, 120] });
    expect(upload.level).toBe("variable");
    expect(upload.reasons.join(" ")).toMatch(/upload samples varied/i);

    const latency = assessSpeedQuality({ ...complete, latencySamples: [5, 80, 9, 120, 7, 100] });
    expect(latency.level).toBe("variable");
    expect(latency.reasons.join(" ")).toMatch(/latency drifted/i);
  });

  it("does not call a result variable when there are too few samples to judge", () => {
    expect(assessSpeedQuality({ ...complete, downloadSamples: [10, 500] }).level).toBe("complete");
  });
});

describe("speedQualityLabel", () => {
  it("gives each level a distinct plain-language label", () => {
    const labels = [
      speedQualityLabel("complete"),
      speedQualityLabel("partial"),
      speedQualityLabel("variable"),
    ];

    expect(new Set(labels).size).toBe(3);
    expect(speedQualityLabel("variable")).toMatch(/variable/i);
  });
});
