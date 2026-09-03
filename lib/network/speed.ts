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
