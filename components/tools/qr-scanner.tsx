"use client";

import { useEffect, useRef, useState } from "react";
import type QrScannerType from "qr-scanner";
import { Camera, Check, Copy, ImageUp, RotateCcw, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const MAX_QR_IMAGE_BYTES = 15 * 1024 * 1024;

export function QrScanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScannerType | null>(null);
  const [result, setResult] = useState("");
  const [message, setMessage] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => () => scannerRef.current?.destroy(), []);

  function stopCamera() {
    scannerRef.current?.destroy(); scannerRef.current = null; setCameraActive(false);
  }
  function showResult(data: string) {
    setResult(data); setMessage(""); stopCamera();
  }

  async function scanFile(file: File | null) {
    stopCamera(); setResult(""); setMessage("");
    if (!file) return;
    if (!file.type.startsWith("image/")) { setMessage("Choose an image containing a QR code."); return; }
    if (file.size === 0 || file.size > MAX_QR_IMAGE_BYTES) { setMessage("Choose a non-empty image no larger than 15 MB."); return; }
    setBusy(true);
    try {
      const QrScanner = (await import("qr-scanner")).default;
      const decoded = await QrScanner.scanImage(file, { returnDetailedScanResult: true, alsoTryWithoutScanRegion: true });
      setResult(decoded.data);
    } catch { setMessage("No readable QR code was found in that image."); }
    finally { setBusy(false); }
  }

  async function startCamera() {
    setResult(""); setMessage(""); setBusy(true);
    try {
      if (!videoRef.current) throw new Error("The camera preview is not ready.");
      const QrScanner = (await import("qr-scanner")).default;
      if (!await QrScanner.hasCamera()) throw new Error("No camera is available to this browser.");
      const scanner = new QrScanner(videoRef.current, (decoded) => showResult(decoded.data), {
        preferredCamera: "environment", maxScansPerSecond: 10, highlightScanRegion: true, highlightCodeOutline: true,
      });
      scannerRef.current = scanner;
      await scanner.start();
      setCameraActive(true);
    } catch (reason) {
      stopCamera();
      setMessage(reason instanceof Error ? reason.message : "Camera access could not be started. Use HTTPS and allow camera permission, or choose an image.");
    } finally { setBusy(false); }
  }

  async function copy() { await navigator.clipboard.writeText(result); setMessage("Decoded text copied."); window.setTimeout(() => setMessage(""), 1800); }
  function reset() { stopCamera(); setResult(""); setMessage(""); }

  return (
    <div>
      <div className="rounded-2xl border border-primary/20 bg-primary/6 p-4 text-sm leading-6">Images and camera frames are decoded locally. Camera permission is requested only after you press <strong>Start camera</strong>.</div>
      <label htmlFor="qr-scan-image" className="mt-6 block text-sm font-semibold">QR image</label>
      <Input id="qr-scan-image" className="mt-2 h-11 cursor-pointer pt-2" type="file" accept="image/*" onChange={(event) => void scanFile(event.target.files?.[0] ?? null)} />
      <div className="relative mt-5 overflow-hidden rounded-2xl bg-black"><video ref={videoRef} className={`aspect-video w-full object-cover ${cameraActive ? "block" : "hidden"}`} muted playsInline /><div className={`grid aspect-video place-items-center text-sm text-white/70 ${cameraActive ? "hidden" : ""}`}><Camera className="mb-2 size-8" /><span>Camera stays off until requested</span></div></div>
      <div className="mt-4 flex flex-wrap gap-2">{!cameraActive ? <Button className="h-10 px-4" onClick={startCamera} disabled={busy}><Camera />{busy ? "Preparing scanner…" : "Start camera"}</Button> : <Button className="h-10 px-4" variant="outline" onClick={stopCamera}><Square />Stop camera</Button>}{(result || cameraActive) && <Button className="h-10 px-4" variant="outline" onClick={reset}><RotateCcw />Reset</Button>}</div>
      {result && <div className="mt-7 border-t border-border/70 pt-6" aria-live="polite"><div className="flex items-center justify-between gap-3"><label htmlFor="qr-scan-result" className="text-sm font-semibold">Decoded content</label><span className="mode-local">Not opened automatically</span></div><div className="mt-2 flex gap-2"><Textarea id="qr-scan-result" className="min-h-28 break-all font-mono text-sm" value={result} readOnly spellCheck={false} /><Button className="h-10 shrink-0 px-3" variant="outline" onClick={copy} aria-label="Copy decoded text">{message === "Decoded text copied." ? <Check /> : <Copy />}</Button></div></div>}
      <p className="mt-4 min-h-5 text-sm text-destructive" role="alert" aria-live="polite">{message || (busy ? "Scanning locally…" : "")}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground"><ImageUp className="mr-1 inline size-3.5" />Decoded links are displayed as text and never opened automatically.</p>
    </div>
  );
}
