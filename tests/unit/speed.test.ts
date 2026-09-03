import { describe, expect, it } from "vitest";

import { formatMbps, formatMilliseconds, speedTestStage } from "../../lib/network/speed";

describe("speed result formatting", () => {
  it("formats bandwidth and latency values", () => {
    expect(formatMbps(87_650_000)).toBe("87.7");
    expect(formatMbps(undefined)).toBe("—");
    expect(formatMilliseconds(8.75)).toBe("8.8");
    expect(formatMilliseconds(42.4)).toBe("42");
  });

  it("labels measurement stages", () => {
    expect(speedTestStage("download")).toMatch(/download/);
    expect(speedTestStage("upload")).toMatch(/upload/);
    expect(speedTestStage("latency")).toMatch(/latency/);
  });
});
