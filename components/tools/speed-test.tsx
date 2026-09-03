"use client";

import { useEffect, useRef, useState } from "react";
import type SpeedTestEngine from "@cloudflare/speedtest";
import type { MeasurementSummary } from "@cloudflare/speedtest";
import { Gauge, Pause, Play, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatMbps, formatMilliseconds, speedTestStage, type SpeedSummary } from "@/lib/network/speed";

const measurements = [
  { type: "latency" as const, numPackets: 1 },
  { type: "download" as const, bytes: 100_000, count: 2, bypassMinDuration: true },
  { type: "latency" as const, numPackets: 10 },
  { type: "download" as const, bytes: 1_000_000, count: 3 },
  { type: "upload" as const, bytes: 100_000, count: 2, bypassMinDuration: true },
  { type: "download" as const, bytes: 10_000_000, count: 2 },
  { type: "upload" as const, bytes: 1_000_000, count: 3 },
  { type: "upload" as const, bytes: 5_000_000, count: 1 },
];

function normalizeSummary(summary: MeasurementSummary): SpeedSummary {
  return {
    download: summary.download,
    upload: summary.upload,
    latency: summary.latency,
    jitter: summary.jitter,
    downLoadedLatency: summary.downLoadedLatency,
    upLoadedLatency: summary.upLoadedLatency,
    totalDurationMs: summary.totalDurationMs,
  };
}

export function SpeedTest() {
  const engineRef = useRef<SpeedTestEngine | null>(null);
  const [summary, setSummary] = useState<SpeedSummary>({});
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("Ready to test");
  const [message, setMessage] = useState("");

  useEffect(() => () => engineRef.current?.pause(), []);

  async function createAndStart() {
    setStarted(true);
    setFinished(false);
    setMessage("");
    setStage("Preparing Cloudflare measurements…");
    setProgress(0);

    try {
      const SpeedTestEngine = (await import("@cloudflare/speedtest")).default;
      const engine = new SpeedTestEngine({
        autoStart: false,
        measurements,
        measureDownloadLoadedLatency: true,
        measureUploadLoadedLatency: true,
        logAimApiUrl: null,
        logMeasurementApiUrl: null,
        includeCredentials: false,
        bandwidthAbortRequestDuration: 10_000,
      });

      engine.onRunningChange = setRunning;
      engine.onPhaseChange = ({ measurementId, measurement }) => {
        setProgress(Math.round((measurementId / measurements.length) * 100));
        setStage(speedTestStage(measurement.type));
      };
      engine.onResultsChange = () => setSummary(normalizeSummary(engine.results.getSummary()));
      engine.onFinish = (results) => {
        setSummary(normalizeSummary(results.getSummary()));
        setProgress(100);
        setStage("Test complete");
        setFinished(true);
        setRunning(false);
      };
      engine.onError = (error) => {
        setMessage(error || "Cloudflare could not complete this measurement.");
        setStage("Test interrupted");
      };
      engineRef.current = engine;
      engine.play();
    } catch (reason) {
      setRunning(false);
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
    setSummary({});
    setFinished(false);
    setMessage("");
    setProgress(0);
    setStage("Restarting measurements…");
    engineRef.current?.restart();
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
        Starting the test sends measurement traffic directly to Cloudflare, which can see your IP address. No file or typed content is sent. This test uses up to roughly 30 MB download and 9 MB upload; NoTrak disables Cloudflare result logging.
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
        {started && !finished && <Button className="h-10 px-4" onClick={togglePause}>{running ? <Pause /> : <Play />}{running ? "Pause" : "Resume"}</Button>}
        {started && <Button className="h-10 px-4" variant="outline" onClick={restart}><RotateCcw /> Restart</Button>}
      </div>

      {finished && summary.totalDurationMs !== undefined && <p className="mt-4 text-sm text-muted-foreground">Completed in {(summary.totalDurationMs / 1000).toFixed(1)} seconds. Results are estimates and can vary with Wi-Fi, browser load, and server conditions.</p>}
      <p className="mt-4 min-h-5 text-sm text-destructive" role="alert" aria-live="polite">{message}</p>
    </div>
  );
}
