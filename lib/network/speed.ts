export type SpeedSummary = {
  download?: number;
  upload?: number;
  latency?: number;
  jitter?: number;
  downLoadedLatency?: number;
  upLoadedLatency?: number;
  totalDurationMs?: number;
};

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
