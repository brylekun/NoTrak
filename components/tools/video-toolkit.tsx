"use client";

import { useEffect, useRef, useState } from "react";
import type { FFmpeg } from "@ffmpeg/ffmpeg";
import { Download, Film, ImageDown, RotateCcw, Scissors, Volume2, VolumeX, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatByteSize } from "@/lib/crypto/hash";
import {
  buildVideoCommand,
  estimateVideoBytes,
  formatDuration,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_DURATION,
  targetVideoDimensions,
  validateVideoFile,
  validateVideoMetadata,
  validateVideoSettings,
  VIDEO_ENGINE_BASE,
  videoInputExtension,
  videoOutputName,
  type VideoAspect,
  type VideoMetadata,
  type VideoQuality,
  type VideoResolution,
  type VideoSettings,
} from "@/lib/video/toolkit";

type VideoResult = { url: string; name: string; size: number };
const selectClass = "mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm";

const defaultSettings = (duration: number): VideoSettings => ({
  start: 0,
  end: Math.floor(duration * 1000) / 1000,
  aspect: "original",
  resolution: 720,
  quality: "balanced",
  muted: false,
  volume: 100,
});

function readVideoMetadata(url: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const element = document.createElement("video");
    let settled = false;
    const timeout = window.setTimeout(() => finish(new Error("The browser took too long to read this video.")), 15_000);
    const finish = (reason?: Error) => {
      if (settled) return;
      settled = true;
      const details = { duration: element.duration, width: element.videoWidth, height: element.videoHeight };
      window.clearTimeout(timeout);
      element.onloadedmetadata = null; element.onerror = null;
      element.removeAttribute("src");
      element.load();
      if (reason) reject(reason);
      else resolve(details);
    };
    element.preload = "metadata";
    element.onloadedmetadata = () => finish();
    element.onerror = () => finish(new Error("This browser could not decode the selected video."));
    element.src = url;
  });
}

export function VideoToolkit() {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const engineRef = useRef<FFmpeg | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const selectionRef = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [settings, setSettings] = useState<VideoSettings | null>(null);
  const [result, setResult] = useState<VideoResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");

  useEffect(() => () => {
    abortRef.current?.abort();
    engineRef.current?.terminate();
  }, []);
  useEffect(() => () => { if (sourceUrl) URL.revokeObjectURL(sourceUrl); }, [sourceUrl]);
  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);

  function clearResult() { setResult(null); setMessage(""); }
  function updateSettings(update: Partial<VideoSettings>) {
    if (!settings) return;
    setSettings({ ...settings, ...update });
    clearResult();
  }

  async function chooseFile(selected: File | null) {
    const selection = selectionRef.current + 1;
    selectionRef.current = selection;
    setFile(null); setMetadata(null); setSettings(null); setSourceUrl(""); clearResult();
    if (!selected) return;
    setBusy(true); setStage("Reading video details…");
    let url = "";
    try {
      validateVideoFile(selected);
      url = URL.createObjectURL(selected);
      const details = await readVideoMetadata(url);
      validateVideoMetadata(details);
      if (selectionRef.current !== selection) { URL.revokeObjectURL(url); return; }
      setFile(selected); setMetadata(details); setSettings(defaultSettings(details.duration)); setSourceUrl(url);
      setMessage("Ready. Choose a trim range and output settings, or move the video playhead to extract a thumbnail.");
    } catch (reason) {
      if (url) URL.revokeObjectURL(url);
      if (selectionRef.current === selection) setMessage(reason instanceof Error ? reason.message : "The video could not be read.");
      if (inputRef.current) inputRef.current.value = "";
    } finally {
      if (selectionRef.current === selection) { setBusy(false); setStage(""); }
    }
  }

  async function loadEngine(signal: AbortSignal) {
    if (engineRef.current?.loaded) return engineRef.current;
    setStage("Loading the 31 MB local video engine…");
    const { FFmpeg } = await import("@ffmpeg/ffmpeg");
    const engine = engineRef.current ?? new FFmpeg();
    engineRef.current = engine;
    await engine.load({
      coreURL: `${VIDEO_ENGINE_BASE}/ffmpeg-core.js`,
      wasmURL: `${VIDEO_ENGINE_BASE}/ffmpeg-core.wasm`,
    }, { signal });
    return engine;
  }

  async function processVideo() {
    if (!file || !metadata || !settings) return;
    try { validateVideoSettings(settings, metadata); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : "Check the trim and output settings."); return; }

    setBusy(true); setProgress(0); setResult(null); setMessage("");
    const controller = new AbortController(); abortRef.current = controller;
    const extension = videoInputExtension(file)!;
    const token = crypto.randomUUID().replaceAll("-", "");
    const inputName = `input-${token}.${extension}`;
    const outputName = `output-${token}.mp4`;
    let engine: FFmpeg | null = null;
    const duration = settings.end - settings.start;
    const onLog = ({ message: log }: { message: string }) => {
      const match = log.match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (!match) return;
      const seconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
      setProgress(Math.min(99, Math.max(1, Math.round(seconds / duration * 100))));
    };
    try {
      engine = await loadEngine(controller.signal);
      setStage("Preparing your video in browser memory…");
      await engine.writeFile(inputName, new Uint8Array(await file.arrayBuffer()), { signal: controller.signal });
      engine.on("log", onLog);
      setStage("Trimming and encoding locally…");
      const exitCode = await engine.exec(buildVideoCommand(inputName, outputName, settings, metadata), -1, { signal: controller.signal });
      if (exitCode !== 0) throw new Error("Encoding failed");
      const data = await engine.readFile(outputName, undefined, { signal: controller.signal });
      if (!(data instanceof Uint8Array) || data.byteLength === 0) throw new Error("Empty output");
      const bytes = new Uint8Array(data.byteLength); bytes.set(data);
      const blob = new Blob([bytes], { type: "video/mp4" });
      setResult({ url: URL.createObjectURL(blob), name: videoOutputName(file.name, "processed", "mp4"), size: blob.size });
      setProgress(100); setMessage("Video ready. Preview the complete output before downloading or sharing it.");
    } catch (reason) {
      const cancelled = controller.signal.aborted;
      setMessage(cancelled ? "Processing canceled. The original video was not changed." : "The browser could not process this video. Try a shorter clip, 720p, or a smaller source file.");
      if (!cancelled) console.error("Local video processing failed", reason instanceof Error ? reason.name : "unknown error");
    } finally {
      engine?.off("log", onLog);
      if (engine?.loaded) {
        await Promise.allSettled([engine.deleteFile(inputName), engine.deleteFile(outputName)]);
      }
      abortRef.current = null; setBusy(false); setStage("");
    }
  }

  function cancel() {
    abortRef.current?.abort();
    engineRef.current?.terminate();
    engineRef.current = null;
  }

  async function downloadThumbnail() {
    if (!file || !metadata || !settings || !videoRef.current) return;
    const video = videoRef.current;
    if (video.readyState < 2) { setMessage("Wait for the preview frame to load, then try again."); return; }
    const target = targetVideoDimensions(metadata, settings.aspect, settings.resolution);
    const canvas = document.createElement("canvas"); canvas.width = target.width; canvas.height = target.height;
    const context = canvas.getContext("2d");
    if (!context) { setMessage("This browser could not create the thumbnail."); return; }
    let sx = 0; let sy = 0; let sw = metadata.width; let sh = metadata.height;
    if (settings.aspect !== "original") {
      const sourceRatio = metadata.width / metadata.height; const targetRatio = target.width / target.height;
      if (sourceRatio > targetRatio) { sw = metadata.height * targetRatio; sx = (metadata.width - sw) / 2; }
      else { sh = metadata.width / targetRatio; sy = (metadata.height - sh) / 2; }
    }
    context.drawImage(video, sx, sy, sw, sh, 0, 0, target.width, target.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) { setMessage("This browser could not create the thumbnail."); return; }
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
    anchor.href = url; anchor.download = videoOutputName(file.name, "thumbnail", "jpg"); anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    setMessage(`Thumbnail captured at ${formatDuration(video.currentTime)}. The image download has started.`);
  }

  function reset() {
    if (busy) cancel();
    selectionRef.current += 1; setFile(null); setSourceUrl(""); setMetadata(null); setSettings(null); setResult(null);
    setBusy(false); setStage(""); setProgress(0); setMessage("");
    if (inputRef.current) inputRef.current.value = "";
  }

  const validated = metadata && settings ? (() => { try { return validateVideoSettings(settings, metadata); } catch { return null; } })() : null;
  const estimated = file && metadata && settings && validated ? estimateVideoBytes(file.size, metadata, settings) : 0;
  const upscaling = Boolean(metadata && validated && (validated.dimensions.width > metadata.width || validated.dimensions.height > metadata.height));

  return <div>
    <div className="callout-info text-sm leading-6"><strong>Processed locally.</strong> The video stays in this browser. No upload, social-media login, URL scraping, or server conversion is used. The original remains unchanged.</div>
    <label htmlFor="video-toolkit-file" className="mt-6 block text-sm font-semibold">Video file</label>
    <Input ref={inputRef} id="video-toolkit-file" className="mt-2 h-11 cursor-pointer pt-2" type="file" accept="video/mp4,video/webm,.mp4,.webm" disabled={busy} onChange={(event) => void chooseFile(event.target.files?.[0] ?? null)} />
    <p className="mt-2 text-xs leading-5 text-muted-foreground">Browser-readable MP4 or WebM, up to {formatByteSize(MAX_VIDEO_BYTES)}, {MAX_VIDEO_DURATION / 60} minutes, and 4K. Processing can take longer than the clip itself.</p>
    <p role="status" className="mt-3 text-sm leading-6 text-muted-foreground">{stage || message}</p>

    {file && metadata && settings && sourceUrl && <>
      <section className="mt-6" aria-labelledby="source-video-heading">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="source-video-heading" className="text-lg font-semibold">Original preview</h2><Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void downloadThumbnail()}><ImageDown />Capture thumbnail</Button></div>
        <video ref={videoRef} className="mt-3 max-h-[28rem] w-full rounded-2xl bg-black" src={sourceUrl} controls preload="metadata">Your browser does not support video preview.</video>
        <p className="mt-3 break-all text-sm font-medium">{file.name}</p>
        <p className="mt-1 text-sm text-muted-foreground">{metadata.width} × {metadata.height} · {formatDuration(metadata.duration)} · {formatByteSize(file.size)}</p>
      </section>

      <section className="mt-7 border-t border-border/70 pt-6" aria-labelledby="trim-heading">
        <h2 id="trim-heading" className="flex items-center gap-2 text-lg font-semibold"><Scissors className="size-5" />Trim</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold">Start (seconds)<Input className="mt-2" type="number" min={0} max={settings.end - 0.5} step="0.1" value={settings.start} disabled={busy} onChange={(e) => updateSettings({ start: Number(e.target.value) })} /></label>
          <label className="text-sm font-semibold">End (seconds)<Input className="mt-2" type="number" min={settings.start + 0.5} max={metadata.duration} step="0.1" value={settings.end} disabled={busy} onChange={(e) => updateSettings({ end: Number(e.target.value) })} /></label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => updateSettings({ start: Number((videoRef.current?.currentTime ?? 0).toFixed(2)) })}>Use playhead as start</Button>
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => updateSettings({ end: Number((videoRef.current?.currentTime ?? metadata.duration).toFixed(2)) })}>Use playhead as end</Button>
        </div>
        {!validated && <p className="mt-3 text-sm text-destructive">Choose a valid range of at least 0.5 seconds within the video.</p>}
      </section>

      <section className="mt-7 border-t border-border/70 pt-6" aria-labelledby="format-heading">
        <h2 id="format-heading" className="flex items-center gap-2 text-lg font-semibold"><Film className="size-5" />Size and compression</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="text-sm font-semibold">Aspect ratio<select aria-label="Aspect ratio" className={selectClass} value={settings.aspect} disabled={busy} onChange={(e) => updateSettings({ aspect: e.target.value as VideoAspect })}><option value="original">Original</option><option value="16:9">Landscape 16:9</option><option value="1:1">Square 1:1</option><option value="4:5">Portrait 4:5</option><option value="9:16">Vertical 9:16</option></select></label>
          <label className="text-sm font-semibold">Resolution<select aria-label="Resolution" className={selectClass} value={settings.resolution} disabled={busy} onChange={(e) => updateSettings({ resolution: Number(e.target.value) as VideoResolution })}><option value="720">720p</option><option value="1080">1080p</option></select></label>
          <label className="text-sm font-semibold">Quality<select aria-label="Quality" className={selectClass} value={settings.quality} disabled={busy} onChange={(e) => updateSettings({ quality: e.target.value as VideoQuality })}><option value="high">High</option><option value="balanced">Balanced</option><option value="small">Smaller file</option></select></label>
        </div>
        {validated && <p className="mt-4 text-sm text-muted-foreground">Output: {validated.dimensions.width} × {validated.dimensions.height} · {formatDuration(validated.duration)} · approximately {formatByteSize(estimated)}</p>}
        <p className="mt-1 text-xs leading-5 text-muted-foreground">The size estimate is only a planning guide; video complexity and source encoding can change the final result.</p>
        {upscaling && <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">This setting enlarges at least one source dimension. It cannot create missing detail.</p>}
      </section>

      <section className="mt-7 border-t border-border/70 pt-6" aria-labelledby="audio-heading">
        <h2 id="audio-heading" className="flex items-center gap-2 text-lg font-semibold">{settings.muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}Audio</h2>
        <label className="mt-4 flex items-center gap-2 text-sm font-medium"><input type="checkbox" className="size-4 accent-primary" checked={settings.muted} disabled={busy} onChange={(e) => updateSettings({ muted: e.target.checked })} />Remove audio</label>
        <label className="mt-4 block text-sm font-semibold">Volume: {settings.volume}%<input aria-label="Audio volume" className="mt-2 w-full accent-primary" type="range" min={0} max={150} step={5} value={settings.volume} disabled={busy || settings.muted} onChange={(e) => updateSettings({ volume: Number(e.target.value) })} /></label>
      </section>

      <div className="mt-7 border-t border-border/70 pt-6">
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={busy || !validated} onClick={() => void processVideo()}><Film />Create MP4</Button>
          {busy && <Button type="button" variant="destructive" onClick={cancel}><X />Cancel</Button>}
          {!busy && <Button type="button" variant="outline" onClick={reset}><RotateCcw />Choose another</Button>}
        </div>
        {(busy || progress > 0) && <div className="mt-4" aria-live="polite"><div className="flex justify-between gap-3 text-sm"><span>{stage || "Complete"}</span><span>{progress}%</span></div><progress className="mt-2 h-2 w-full accent-primary" max={100} value={progress}>{progress}%</progress></div>}
      </div>

      {result && <section className="result-enter mt-7 border-t border-border/70 pt-6" aria-labelledby="result-video-heading"><h2 id="result-video-heading" className="text-lg font-semibold">Processed video</h2><video className="mt-3 max-h-[28rem] w-full rounded-2xl bg-black" src={result.url} controls preload="metadata">Your browser does not support video preview.</video><p className="mt-3 text-sm text-muted-foreground">MP4 · {formatByteSize(result.size)}</p><Button className="mt-4" nativeButton={false} render={<a href={result.url} download={result.name} />}><Download />Download {result.name}</Button></section>}
    </>}
  </div>;
}
