"use client";

import { useState } from "react";
import { Download, QrCode, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function QrGenerator() {
  const [value, setValue] = useState("");
  const [dark, setDark] = useState("#123b35");
  const [light, setLight] = useState("#ffffff");
  const [dataUrl, setDataUrl] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  function clearResult() {
    setDataUrl("");
    setMessage("");
  }

  async function generate() {
    if (!value.trim()) {
      setMessage("Enter text or a link to encode.");
      return;
    }
    if (value.length > 2000) {
      setMessage("Keep QR content to 2,000 characters or fewer.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const QRCodeLibrary = (await import("qrcode")).default;
      setDataUrl(await QRCodeLibrary.toDataURL(value, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 1024,
        color: { dark, light },
      }));
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "QR generation failed.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setValue("");
    setDataUrl("");
    setMessage("");
  }

  return (
    <div>
      <label htmlFor="qr-content" className="text-sm font-semibold">Text or link</label>
      <Textarea
        id="qr-content"
        className="mt-2 min-h-28 text-sm"
        value={value}
        maxLength={2000}
        onChange={(event) => { setValue(event.target.value); clearResult(); }}
        placeholder="https://example.com"
        spellCheck={false}
      />
      <div className="mt-2 text-right text-xs text-muted-foreground">{value.length} / 2,000</div>

      <fieldset className="mt-5">
        <legend className="text-sm font-semibold">Colors</legend>
        <div className="mt-2 flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input className="size-9 cursor-pointer rounded border-0 bg-transparent" type="color" value={dark} onChange={(event) => { setDark(event.target.value); clearResult(); }} />
            Foreground
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input className="size-9 cursor-pointer rounded border-0 bg-transparent" type="color" value={light} onChange={(event) => { setLight(event.target.value); clearResult(); }} />
            Background
          </label>
        </div>
      </fieldset>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button className="h-10 px-4" onClick={generate} disabled={busy}>
          <QrCode aria-hidden="true" /> {busy ? "Generating…" : "Generate QR code"}
        </Button>
        {(value || dataUrl) && <Button className="h-10 px-4" variant="outline" onClick={reset}><RotateCcw /> Reset</Button>}
      </div>

      {dataUrl && (
        <div className="mt-7 grid justify-items-center gap-4 border-t border-border/70 pt-6" aria-live="polite">
          {/* A data URL keeps the generated QR entirely in this document. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="w-full max-w-72 rounded-2xl border border-border bg-white p-3" src={dataUrl} alt="Generated QR code preview" />
          <Button className="h-10 px-4" nativeButton={false} render={<a href={dataUrl} download="notrak-qr-code.png" />}>
            <Download aria-hidden="true" /> Download PNG
          </Button>
          <p className="text-center text-xs leading-5 text-muted-foreground">Test the downloaded code before printing or sharing it.</p>
        </div>
      )}

      <p className="mt-4 min-h-5 text-sm text-destructive" role="alert" aria-live="polite">{message}</p>
    </div>
  );
}
