"use client";

import { useEffect, useRef, useState } from "react";
import type SpeedTestEngine from "@cloudflare/speedtest";
import type { Results } from "@cloudflare/speedtest";
import { Gauge, Pause, Play, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  filterLatencyOutliers,
  formatMbps,
  formatMilliseconds,
  latencyJitter,
  medianPositiveMeasurement,
  positiveEstimate,
  speedTestStage,
  type SpeedSummary,
} from "@/lib/network/speed";

// Ramp to larger payloads only while earlier requests are too short to
// characterize the connection. The engine stops later rounds after a request
// reaches bandwidthFinishRequestDuration.
const measurements = [
  { type: "latency" as const, numPackets: 2 },
  { type: "download" as const, bytes: 100_000, count: 1, bypassMinDuration: true },
  { type: "latency" as const, numPackets: 20 },
  { type: "download" as const, bytes: 1_000_000, count: 4 },
  { type: "upload" as const, bytes: 100_000, count: 2, bypassMinDuration: true },
  { type: "download" as const, bytes: 10_000_000, count: 3 },
  { type: "upload" as const, bytes: 1_000_000, count: 4 },
  { type: "download" as const, bytes: 25_000_000, count: 2 },
  { type: "upload" as const, bytes: 10_000_000, count: 3 },
  { type: "upload" as const, bytes: 25_000_000, count: 2 },
];

const latencyProbeCount = 11;
const minimumIdleLatencySamples = 5;

async function measureIdleLatency(signal: AbortSignal): Promise<Pick<SpeedSummary, "latency" | "jitter">> {
  const samples: number[] = [];

  for (let index = 0; index < latencyProbeCount; index += 1) {
    const url = new URL("https://speed.cloudflare.com/__down");
    url.searchParams.set("bytes", "0");
    url.searchParams.set("no-cache", `${Date.now()}-${index}`);
    const resourceName = url.href;

    try {
      const response = await fetch(url, {
        cache: "no-store",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        signal: AbortSignal.any([signal, AbortSignal.timeout(5_000)]),
      });
      if (!response.ok) continue;
      await response.arrayBuffer();

      // The first request establishes the connection and is intentionally not
      // counted as steady-state latency.
      if (index > 0) {
        const timing = performance.getEntriesByName(resourceName, "resource").at(-1) as PerformanceResourceTiming | undefined;
        if (timing) samples.push(timing.responseStart - timing.requestStart);
      }
    } catch (reason) {
      if (signal.aborted) throw reason;
    }
  }

  const filteredSamples = filterLatencyOutliers(samples);

  return {
    latency: medianPositiveMeasurement(filteredSamples, minimumIdleLatencySamples),
    jitter: latencyJitter(filteredSamples, minimumIdleLatencySamples),
  };
}

function normalizeResults(
  results: Results,
  idleLatency: Pick<SpeedSummary, "latency" | "jitter">,
): SpeedSummary {
  const summary = results.getSummary();
  const unloadedLatency = filterLatencyOutliers(results.getUnloadedLatencyPoints());
  const downloadLoadedLatency = filterLatencyOutliers(results.getDownLoadedLatencyPoints());
  const uploadLoadedLatency = filterLatencyOutliers(results.getUpLoadedLatencyPoints());

  return {
    download: positiveEstimate(
      summary.download,
      results.getDownloadBandwidthPoints()
        .filter((point) => point.duration >= 10)
        .map((point) => point.bps),
      3,
    ),
    upload: positiveEstimate(
      summary.upload,
      results.getUploadBandwidthPoints()
        .filter((point) => point.duration >= 10)
        .map((point) => point.bps),
      3,
    ),
    latency: idleLatency.latency ?? medianPositiveMeasurement(unloadedLatency, minimumIdleLatencySamples),
    jitter: idleLatency.jitter ?? latencyJitter(unloadedLatency, minimumIdleLatencySamples),
    downLoadedLatency: medianPositiveMeasurement(downloadLoadedLatency, 2),
    upLoadedLatency: medianPositiveMeasurement(uploadLoadedLatency, 2),
    totalDurationMs: summary.totalDurationMs,
  };
}

export function SpeedTest() {
  const engineRef = useRef<SpeedTestEngine | null>(null);
  const probeControllerRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);
  const [summary, setSummary] = useState<SpeedSummary>({});
  const [running, setRunning] = useState(false);
  const [engineReady, setEngineReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("Ready to test");
  const [message, setMessage] = useState("");

  useEffect(() => () => {
    runIdRef.current += 1;
    probeControllerRef.current?.abort();
    engineRef.current?.pause();
  }, []);

  async function createAndStart() {
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    probeControllerRef.current?.abort();
    engineRef.current?.pause();
    engineRef.current = null;

    const probeController = new AbortController();
    probeControllerRef.current = probeController;
    setStarted(true);
    setFinished(false);
    setEngineReady(false);
    setRunning(true);
    setSummary({});
    setMessage("");
    setStage("Measuring idle latency and jitter…");
    setProgress(0);

    try {
      const idleLatency = await measureIdleLatency(probeController.signal);
      if (runId !== runIdRef.current) return;
      probeControllerRef.current = null;
      setSummary(idleLatency);
      setProgress(10);
      setStage("Preparing bandwidth measurements…");

      const SpeedTestEngine = (await import("@cloudflare/speedtest")).default;
      if (runId !== runIdRef.current) return;
      const measurementErrors: string[] = [];
      const engine = new SpeedTestEngine({
        autoStart: false,
        measurements,
        measureDownloadLoadedLatency: true,
        measureUploadLoadedLatency: true,
        logAimApiUrl: null,
        logMeasurementApiUrl: null,
        includeCredentials: false,
        loadedLatencyThrottle: 150,
        loadedRequestMinDuration: 200,
        bandwidthAbortRequestDuration: 10_000,
      });

      engine.onRunningChange = (isRunning) => {
        if (runId === runIdRef.current) setRunning(isRunning);
      };
      engine.onPhaseChange = ({ measurementId, measurement }) => {
        if (runId !== runIdRef.current) return;
        setProgress(10 + Math.round((measurementId / measurements.length) * 90));
        setStage(speedTestStage(measurement.type));
      };
      engine.onResultsChange = () => {
        if (runId === runIdRef.current) setSummary(normalizeResults(engine.results, idleLatency));
      };
      engine.onFinish = (results) => {
        if (runId !== runIdRef.current) return;
        const finalSummary = normalizeResults(results, idleLatency);
        const requiredResults = [
          finalSummary.download,
          finalSummary.upload,
          finalSummary.latency,
          finalSummary.jitter,
          finalSummary.downLoadedLatency,
          finalSummary.upLoadedLatency,
        ];
        const partial = measurementErrors.length > 0 || requiredResults.some((value) => value === undefined);

        setSummary(finalSummary);
        setProgress(100);
        setStage(partial ? "Partial results" : "Test complete");
        setMessage(partial ? "Some Cloudflare measurements were unavailable. The valid results are shown; try again on a stable connection for a complete result." : "");
        setFinished(true);
        setRunning(false);
        setEngineReady(false);
      };
      engine.onError = (error) => {
        measurementErrors.push(error || "Cloudflare could not complete this measurement.");
        if (runId !== runIdRef.current) return;
        setMessage("A Cloudflare measurement failed. NoTrak will preserve any valid partial results.");
        setStage("Measurement issue detected…");
      };
      engineRef.current = engine;
      setEngineReady(true);
      engine.play();
    } catch (reason) {
      if (runId !== runIdRef.current) return;
      setRunning(false);
      setEngineReady(false);
      setFinished(true);
      setMessage(reason instanceof Error ? reason.message : "The speed-test engine could not start.");
      setStage("Test unavailable");
    }
  }

  function togglePause() {
    const engine = engineRef.current;
    if (!engine || engine.isFinished) return;
    if (engine.isRunning) {
      engine.pause();
      setStage("Test paused");
    } else {
      engine.play();
    }
  }

  function restart() {
    void createAndStart();
  }

  const metrics = [
    ["Download", formatMbps(summary.download), "Mbps"],
    ["Upload", formatMbps(summary.upload), "Mbps"],
    ["Latency", formatMilliseconds(summary.latency), "ms"],
    ["Jitter", formatMilliseconds(summary.jitter), "ms"],
    ["Loaded download", formatMilliseconds(summary.downLoadedLatency), "ms"],
    ["Loaded upload", formatMilliseconds(summary.upLoadedLatency), "ms"],
  ];

  return (
    <div>
      <div className="rounded-2xl border border-amber-300/60 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-200">
        Starting the test sends measurement traffic directly to Cloudflare, which can see your IP address. No file or typed content is sent. The adaptive test usually stops early, but can use up to roughly 85 MB download and 85 MB upload on very fast connections. NoTrak disables Cloudflare result logging.
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {metrics.map(([label, value, unit]) => (
          <div key={label} className="rounded-2xl border border-border/70 bg-muted/35 p-4 text-center">
            <p className="text-2xl font-semibold tracking-tight">{value}</p>
            <p className="text-xs font-medium text-muted-foreground">{unit}</p>
            <p className="mt-2 text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {started && (
        <div className="mt-6" aria-live="polite">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="font-medium">{stage}</span>
            <span className="font-mono text-muted-foreground">{progress}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="Speed test progress">
            <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {!started && <Button className="h-10 px-4" onClick={createAndStart}><Gauge /> Start speed test</Button>}
        {started && !finished && engineReady && <Button className="h-10 px-4" onClick={togglePause}>{running ? <Pause /> : <Play />}{running ? "Pause" : "Resume"}</Button>}
        {started && <Button className="h-10 px-4" variant="outline" onClick={restart}><RotateCcw /> Restart</Button>}
      </div>

      {finished && summary.totalDurationMs !== undefined && (
        <p className="mt-4 text-sm text-muted-foreground">
          Completed in {(summary.totalDurationMs / 1000).toFixed(1)} seconds. An em dash means the browser did not produce enough valid samples. Results are estimates and can vary with Wi-Fi, browser load, and server conditions.
        </p>
      )}
      <p className="mt-4 min-h-5 text-sm text-destructive" role="alert" aria-live="polite">{message}</p>
    </div>
  );
}
