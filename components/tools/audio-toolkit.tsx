"use client";

import { useEffect, useRef, useState } from "react";
import type { FFmpeg } from "@ffmpeg/ffmpeg";
import { Download, Music2, RotateCcw, Scissors, Volume2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import {
  AUDIO_ENGINE_BASE,
  audioInputExtension,
  audioOutputName,
  buildAudioCommand,
  estimateAudioBytes,
  formatAudioDuration,
  MAX_AUDIO_BYTES,
  MAX_AUDIO_DURATION,
  validateAudioFile,
  validateAudioMetadata,
  validateAudioSettings,
  type AudioBitrate,
  type AudioFormat,
  type AudioMetadata,
  type AudioSettings,
} from "@/lib/audio/toolkit";
import { formatByteSize } from "@/lib/crypto/hash";

type AudioResult = { url: string; name: string; size: number; format: AudioFormat };

const MIME_TYPES: Record<AudioFormat, string> = { mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav" };

function defaultSettings(duration: number): AudioSettings {
  return {
    start: 0,
    end: Math.floor(duration * 1000) / 1000,
    format: "mp3",
    bitrate: 192,
    volume: 100,
    normalize: false,
    mono: false,
    fadeIn: 0,
    fadeOut: 0,
  };
}

function readAudioMetadata(url: string): Promise<AudioMetadata> {
  return new Promise((resolve, reject) => {
    const element = document.createElement("audio");
    let settled = false;
    const timeout = window.setTimeout(() => finish(new Error("The browser took too long to read this audio file.")), 15_000);
    const finish = (reason?: Error) => {
      if (settled) return;
      settled = true;
      const duration = element.duration;
      window.clearTimeout(timeout);
      element.onloadedmetadata = null;
      element.onerror = null;
      element.removeAttribute("src");
      element.load();
      if (reason) reject(reason);
      else resolve({ duration });
    };
    element.preload = "metadata";
    element.onloadedmetadata = () => finish();
    element.onerror = () => finish(new Error("This browser could not decode the selected audio file."));
    element.src = url;
  });
}

export function AudioToolkit() {
  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const engineRef = useRef<FFmpeg | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const selectionRef = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [metadata, setMetadata] = useState<AudioMetadata | null>(null);
  const [settings, setSettings] = useState<AudioSettings | null>(null);
  const [result, setResult] = useState<AudioResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"neutral" | "success" | "error">("neutral");

  useEffect(() => () => {
    abortRef.current?.abort();
    engineRef.current?.terminate();
  }, []);
  useEffect(() => () => { if (sourceUrl) URL.revokeObjectURL(sourceUrl); }, [sourceUrl]);
  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);

  function clearResult() {
    setResult(null);
    setProgress(0);
  }

  function updateSettings(update: Partial<AudioSettings>) {
    if (!settings) return;
    setSettings({ ...settings, ...update });
    setMessage("");
    clearResult();
  }

  async function chooseFile(selected: File | null) {
    const selection = selectionRef.current + 1;
    selectionRef.current = selection;
    setFile(null);
    setMetadata(null);
    setSettings(null);
    setSourceUrl("");
    setMessage("");
    clearResult();
    if (!selected) return;
    setBusy(true);
    setStage("Reading audio details…");
    let url = "";
    try {
      validateAudioFile(selected);
      url = URL.createObjectURL(selected);
      const details = await readAudioMetadata(url);
      validateAudioMetadata(details);
      if (selectionRef.current !== selection) {
        URL.revokeObjectURL(url);
        return;
      }
      setFile(selected);
      setMetadata(details);
      setSettings(defaultSettings(details.duration));
      setSourceUrl(url);
      setMessageTone("neutral");
      setMessage("Ready. Preview the source and choose the output settings.");
    } catch (reason) {
      if (url) URL.revokeObjectURL(url);
      if (selectionRef.current === selection) {
        setMessageTone("error");
        setMessage(reason instanceof Error ? reason.message : "The audio file could not be read.");
      }
      if (inputRef.current) inputRef.current.value = "";
    } finally {
      if (selectionRef.current === selection) {
        setBusy(false);
        setStage("");
      }
    }
  }

  async function loadEngine(signal: AbortSignal) {
    if (engineRef.current?.loaded) return engineRef.current;
    setStage("Loading the 31 MB local audio engine…");
    const { FFmpeg } = await import("@ffmpeg/ffmpeg");
    const engine = engineRef.current ?? new FFmpeg();
    engineRef.current = engine;
    await engine.load({
      coreURL: `${AUDIO_ENGINE_BASE}/ffmpeg-core.js`,
      wasmURL: `${AUDIO_ENGINE_BASE}/ffmpeg-core.wasm`,
    }, { signal });
    return engine;
  }

  async function processAudio() {
    if (!file || !metadata || !settings) return;
    try {
      validateAudioSettings(settings, metadata);
    } catch (reason) {
      setMessageTone("error");
      setMessage(reason instanceof Error ? reason.message : "Check the trim and audio settings.");
      return;
    }

    setBusy(true);
    setProgress(0);
    setResult(null);
    setMessage("");
    const controller = new AbortController();
    abortRef.current = controller;
    const extension = audioInputExtension(file)!;
    const token = crypto.randomUUID().replaceAll("-", "");
    const inputName = `input-${token}.${extension}`;
    const outputName = `output-${token}.${settings.format}`;
    const duration = settings.end - settings.start;
    let engine: FFmpeg | null = null;
    const onLog = ({ message: log }: { message: string }) => {
      const match = log.match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/u);
      if (!match) return;
      const seconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
      setProgress(Math.min(99, Math.max(1, Math.round(seconds / duration * 100))));
    };
    try {
      engine = await loadEngine(controller.signal);
      setStage("Preparing audio in browser memory…");
      await engine.writeFile(inputName, new Uint8Array(await file.arrayBuffer()), { signal: controller.signal });
      engine.on("log", onLog);
      setStage("Trimming and encoding locally…");
      const exitCode = await engine.exec(buildAudioCommand(inputName, outputName, settings, metadata), -1, { signal: controller.signal });
      if (exitCode !== 0) throw new Error("Encoding failed");
      const data = await engine.readFile(outputName, undefined, { signal: controller.signal });
      if (!(data instanceof Uint8Array) || data.byteLength === 0) throw new Error("Empty output");
      const bytes = new Uint8Array(data.byteLength);
      bytes.set(data);
      const blob = new Blob([bytes], { type: MIME_TYPES[settings.format] });
      setResult({
        url: URL.createObjectURL(blob),
        name: audioOutputName(file.name, settings.format),
        size: blob.size,
        format: settings.format,
      });
      setProgress(100);
      setMessageTone("success");
      setMessage("Audio ready. Listen to the complete result before downloading or sharing it.");
    } catch (reason) {
      const cancelled = controller.signal.aborted;
      setMessageTone(cancelled ? "neutral" : "error");
      setMessage(cancelled ? "Processing canceled. The original audio file was not changed." : "The browser could not process this audio file. Try a shorter clip or WAV output.");
      if (!cancelled) console.error("Local audio processing failed", reason instanceof Error ? reason.name : "unknown error");
    } finally {
      engine?.off("log", onLog);
      if (engine?.loaded) await Promise.allSettled([engine.deleteFile(inputName), engine.deleteFile(outputName)]);
      abortRef.current = null;
      setBusy(false);
      setStage("");
    }
  }

  function cancel() {
    abortRef.current?.abort();
    engineRef.current?.terminate();
    engineRef.current = null;
  }

  function reset() {
    if (busy) cancel();
    selectionRef.current += 1;
    setFile(null);
    setSourceUrl("");
    setMetadata(null);
    setSettings(null);
    setResult(null);
    setBusy(false);
    setStage("");
    setProgress(0);
    setMessage("");
    if (inputRef.current) inputRef.current.value = "";
  }

  const validation = metadata && settings ? (() => {
    try { return validateAudioSettings(settings, metadata); } catch { return null; }
  })() : null;
  const estimate = metadata && settings && validation ? estimateAudioBytes(settings, metadata) : 0;

  return (
    <div>
      <div className="callout-info text-sm leading-6"><strong>Processed locally.</strong> Audio stays in this browser. No upload, microphone permission, account, or server conversion is used. The original remains unchanged.</div>

      <label htmlFor="audio-toolkit-file" className="mt-6 block text-sm font-semibold">Audio file</label>
      <Input
        ref={inputRef}
        id="audio-toolkit-file"
        className="mt-2 h-11 cursor-pointer pt-2"
        type="file"
        accept="audio/mpeg,audio/mp4,audio/aac,audio/wav,audio/ogg,audio/webm,.mp3,.m4a,.aac,.wav,.ogg,.oga,.webm"
        disabled={busy}
        onChange={(event) => void chooseFile(event.target.files?.[0] ?? null)}
      />
      <p className="mt-2 text-xs leading-5 text-muted-foreground">Browser-readable MP3, M4A, AAC, WAV, OGG, or WebM · up to {formatByteSize(MAX_AUDIO_BYTES)} and {MAX_AUDIO_DURATION / 60} minutes. The local engine loads only when you create the output.</p>
      {stage ? <FeedbackMessage className="mt-3">{stage}</FeedbackMessage> : <FeedbackMessage className="mt-3" tone={messageTone}>{message}</FeedbackMessage>}

      {file && metadata && settings && sourceUrl && (
        <>
          <section className="mt-6" aria-labelledby="source-audio-heading">
            <h2 id="source-audio-heading" className="text-lg font-semibold">Original preview</h2>
            <audio ref={audioRef} className="mt-3 w-full" src={sourceUrl} controls preload="metadata">Your browser does not support audio preview.</audio>
            <p className="mt-3 break-all text-sm font-medium">{file.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">{formatAudioDuration(metadata.duration)} · {formatByteSize(file.size)}</p>
          </section>

          <section className="mt-7 border-t border-border/70 pt-6" aria-labelledby="audio-trim-heading">
            <h2 id="audio-trim-heading" className="flex items-center gap-2 text-lg font-semibold"><Scissors className="size-5" />Trim</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold">Start (seconds)<Input className="mt-2" type="number" min={0} max={settings.end - 0.25} step="0.1" value={settings.start} disabled={busy} onChange={(event) => updateSettings({ start: Number(event.target.value) })} /></label>
              <label className="text-sm font-semibold">End (seconds)<Input className="mt-2" type="number" min={settings.start + 0.25} max={metadata.duration} step="0.1" value={settings.end} disabled={busy} onChange={(event) => updateSettings({ end: Number(event.target.value) })} /></label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => updateSettings({ start: Number((audioRef.current?.currentTime ?? 0).toFixed(2)) })}>Use playhead as start</Button>
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => updateSettings({ end: Number((audioRef.current?.currentTime ?? metadata.duration).toFixed(2)) })}>Use playhead as end</Button>
            </div>
            {!validation && <p className="mt-3 text-sm text-destructive">Choose a valid range of at least 0.25 seconds. The combined fades must also fit inside it.</p>}
          </section>

          <section className="mt-7 border-t border-border/70 pt-6" aria-labelledby="audio-output-heading">
            <h2 id="audio-output-heading" className="flex items-center gap-2 text-lg font-semibold"><Music2 className="size-5" />Format and quality</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Output format"
                value={settings.format}
                disabled={busy}
                options={[{ value: "mp3", label: "MP3 — widely compatible" }, { value: "m4a", label: "M4A — efficient AAC" }, { value: "wav", label: "WAV — uncompressed" }]}
                onValueChange={(format) => updateSettings({ format: format as AudioFormat })}
              />
              <SelectField
                label="Bitrate"
                value={settings.bitrate}
                disabled={busy || settings.format === "wav"}
                options={[{ value: 128, label: "128 kbps — smaller" }, { value: 192, label: "192 kbps — balanced" }, { value: 256, label: "256 kbps — higher quality" }]}
                onValueChange={(bitrate) => updateSettings({ bitrate: bitrate as AudioBitrate })}
                description={settings.format === "wav" ? "WAV is uncompressed, so bitrate does not apply." : "Higher bitrates preserve more detail and create larger files."}
              />
            </div>
            {validation && <p className="mt-4 text-sm text-muted-foreground">Output: {formatAudioDuration(validation.duration)} · approximately {formatByteSize(estimate)}</p>}
          </section>

          <section className="mt-7 border-t border-border/70 pt-6" aria-labelledby="audio-adjust-heading">
            <h2 id="audio-adjust-heading" className="flex items-center gap-2 text-lg font-semibold"><Volume2 className="size-5" />Sound adjustments</h2>
            <label className="mt-4 block text-sm font-semibold">Volume: {settings.volume}%<input aria-label="Audio volume" className="mt-2 w-full accent-primary" type="range" min={0} max={200} step={5} value={settings.volume} disabled={busy} onChange={(event) => updateSettings({ volume: Number(event.target.value) })} /></label>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="flex items-start gap-3 rounded-xl border border-border/80 p-3 text-sm leading-6"><input type="checkbox" className="mt-1 size-4 accent-primary" checked={settings.normalize} disabled={busy} onChange={(event) => updateSettings({ normalize: event.target.checked })} /><span><strong>Normalize loudness</strong><br /><span className="text-xs text-muted-foreground">Targets consistent listening volume near −16 LUFS.</span></span></label>
              <label className="flex items-start gap-3 rounded-xl border border-border/80 p-3 text-sm leading-6"><input type="checkbox" className="mt-1 size-4 accent-primary" checked={settings.mono} disabled={busy} onChange={(event) => updateSettings({ mono: event.target.checked })} /><span><strong>Convert to mono</strong><br /><span className="text-xs text-muted-foreground">Useful for speech and smaller files.</span></span></label>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold">Fade in (seconds)<Input className="mt-2" type="number" min={0} max={10} step="0.1" value={settings.fadeIn} disabled={busy} onChange={(event) => updateSettings({ fadeIn: Number(event.target.value) })} /></label>
              <label className="text-sm font-semibold">Fade out (seconds)<Input className="mt-2" type="number" min={0} max={10} step="0.1" value={settings.fadeOut} disabled={busy} onChange={(event) => updateSettings({ fadeOut: Number(event.target.value) })} /></label>
            </div>
          </section>

          <div className="mt-7 border-t border-border/70 pt-6">
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={busy || !validation} onClick={() => void processAudio()}><Music2 />Create {settings.format.toUpperCase()}</Button>
              {busy && <Button type="button" variant="destructive" onClick={cancel}><X />Cancel</Button>}
              {!busy && <Button type="button" variant="outline" onClick={reset}><RotateCcw />Choose another</Button>}
            </div>
            {(busy || progress > 0) && <div className="mt-4" aria-live="polite"><div className="flex justify-between gap-3 text-sm"><span>{stage || "Complete"}</span><span>{progress}%</span></div><progress className="mt-2 h-2 w-full accent-primary" max={100} value={progress}>{progress}%</progress></div>}
          </div>

          {result && (
            <section className="result-enter mt-7 border-t border-border/70 pt-6" aria-labelledby="result-audio-heading">
              <h2 id="result-audio-heading" className="text-lg font-semibold">Processed audio</h2>
              <audio className="mt-3 w-full" src={result.url} controls preload="metadata">Your browser does not support audio preview.</audio>
              <p className="mt-3 text-sm text-muted-foreground">{result.format.toUpperCase()} · {formatByteSize(result.size)} · source metadata removed</p>
              <Button className="mt-4" nativeButton={false} render={<a href={result.url} download={result.name} />}><Download />Download {result.name}</Button>
            </section>
          )}
        </>
      )}
    </div>
  );
}
