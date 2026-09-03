export type SpeedSummary = {
  download?: number;
  upload?: number;
  latency?: number;
  jitter?: number;
  downLoadedLatency?: number;
  upLoadedLatency?: number;
  totalDurationMs?: number;
};

function finitePositiveValues(values: readonly number[]) {
  return values.filter((value) => Number.isFinite(value) && value > 0);
}

function percentile(sortedValues: readonly number[], fraction: number) {
  const position = (sortedValues.length - 1) * fraction;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const weight = position - lowerIndex;

  return sortedValues[lowerIndex] + (sortedValues[upperIndex] - sortedValues[lowerIndex]) * weight;
}

export function filterLatencyOutliers(values: readonly number[]) {
  const samples = finitePositiveValues(values);
  if (samples.length < 4) return samples;

  const sortedSamples = [...samples].sort((left, right) => left - right);
  const firstQuartile = percentile(sortedSamples, 0.25);
  const thirdQuartile = percentile(sortedSamples, 0.75);
  const margin = Math.max((thirdQuartile - firstQuartile) * 1.5, 1);
  const lowerBound = firstQuartile - margin;
  const upperBound = thirdQuartile + margin;

  return samples.filter((sample) => sample >= lowerBound && sample <= upperBound);
}

export function positiveEstimate(
  estimate: number | undefined,
  samples: readonly number[],
  minimumSamples: number,
) {
  if (
    estimate === undefined ||
    !Number.isFinite(estimate) ||
    estimate <= 0 ||
    finitePositiveValues(samples).length < minimumSamples
  ) {
    return undefined;
  }

  return estimate;
}

export function medianPositiveMeasurement(values: readonly number[], minimumSamples: number) {
  const samples = finitePositiveValues(values).sort((left, right) => left - right);
  if (samples.length < minimumSamples) return undefined;

  const middle = Math.floor(samples.length / 2);
  if (samples.length % 2 === 1) return samples[middle];
  return (samples[middle - 1] + samples[middle]) / 2;
}

export function latencyJitter(values: readonly number[], minimumSamples: number) {
  const samples = finitePositiveValues(values);
  if (samples.length < minimumSamples) return undefined;

  let totalDifference = 0;
  for (let index = 1; index < samples.length; index += 1) {
    totalDifference += Math.abs(samples[index] - samples[index - 1]);
  }

  return totalDifference / (samples.length - 1);
}

export type SpeedQualityLevel = "complete" | "partial" | "variable";

export type SpeedQuality = {
  level: SpeedQualityLevel;
  /** Plain-language explanations, most important first. */
  reasons: string[];
};

export type SpeedQualityInput = {
  summary: SpeedSummary;
  downloadSamples: readonly number[];
  uploadSamples: readonly number[];
  latencySamples: readonly number[];
  /** Measurements the engine reported as failed. */
  measurementErrors: number;
};

// Above this relative spread the samples disagree enough that a single headline
// number would overstate the precision of the result.
const UNSTABLE_BANDWIDTH_SPREAD = 0.35;
const UNSTABLE_LATENCY_SPREAD = 0.5;

/**
 * Interquartile range divided by the median: a spread measure that is not
 * dragged around by one outlier the way a standard deviation is. Returns
 * undefined when there are too few samples to say anything.
 */
export function relativeSpread(values: readonly number[]) {
  const samples = finitePositiveValues(values);
  if (samples.length < 4) return undefined;

  const sorted = [...samples].sort((left, right) => left - right);
  const median = percentile(sorted, 0.5);
  if (median <= 0) return undefined;

  return (percentile(sorted, 0.75) - percentile(sorted, 0.25)) / median;
}

export function assessSpeedQuality(input: SpeedQualityInput): SpeedQuality {
  const { summary, downloadSamples, uploadSamples, latencySamples, measurementErrors } = input;

  const missing = (
    [
      ["download speed", summary.download],
      ["upload speed", summary.upload],
      ["latency", summary.latency],
      ["jitter", summary.jitter],
      ["loaded download latency", summary.downLoadedLatency],
      ["loaded upload latency", summary.upLoadedLatency],
    ] as const
  )
    .filter(([, value]) => value === undefined)
    .map(([label]) => label);

  if (missing.length > 0 || measurementErrors > 0) {
    const reasons: string[] = [];
    if (missing.length > 0) {
      reasons.push(
        `The browser did not produce enough valid samples for ${missing.join(", ")}. Those values are shown as an em dash rather than guessed.`,
      );
    }
    if (measurementErrors > 0) {
      reasons.push(
        `${measurementErrors} ${measurementErrors === 1 ? "measurement" : "measurements"} could not be completed. The values that did arrive are still shown.`,
      );
    }
    return { level: "partial", reasons };
  }

  const reasons: string[] = [];
  const downloadSpread = relativeSpread(downloadSamples);
  const uploadSpread = relativeSpread(uploadSamples);
  const latencySpread = relativeSpread(latencySamples);

  if (downloadSpread !== undefined && downloadSpread > UNSTABLE_BANDWIDTH_SPREAD) {
    reasons.push("Download samples varied widely, so the real speed is probably a range rather than one number.");
  }
  if (uploadSpread !== undefined && uploadSpread > UNSTABLE_BANDWIDTH_SPREAD) {
    reasons.push("Upload samples varied widely, which is common on Wi-Fi and mobile connections.");
  }
  if (latencySpread !== undefined && latencySpread > UNSTABLE_LATENCY_SPREAD) {
    reasons.push("Latency drifted between probes, which usually means competing traffic or an unstable link.");
  }

  if (reasons.length > 0) {
    reasons.push("Run the test again on a wired connection, or repeat it a few times and compare.");
    return { level: "variable", reasons };
  }

  return {
    level: "complete",
    reasons: ["Every measurement returned enough consistent samples. Results are still estimates, not laboratory figures."],
  };
}

export function speedQualityLabel(level: SpeedQualityLevel) {
  if (level === "complete") return "Complete measurement";
  if (level === "variable") return "Complete but variable";
  return "Partial measurement";
}

export function formatMbps(bitsPerSecond?: number) {
  if (bitsPerSecond === undefined || !Number.isFinite(bitsPerSecond)) return "—";
  return (bitsPerSecond / 1_000_000).toFixed(bitsPerSecond >= 100_000_000 ? 0 : 1);
}

export function formatMilliseconds(value?: number) {
  if (value === undefined || !Number.isFinite(value)) return "—";
  return value < 10 ? value.toFixed(1) : Math.round(value).toString();
}

export function speedTestStage(type: string) {
  if (type.includes("download")) return "Measuring download speed and loaded latency…";
  if (type.includes("upload")) return "Measuring upload speed and loaded latency…";
  if (type.includes("latency")) return "Measuring idle latency and jitter…";
  return "Measuring your connection…";
}
