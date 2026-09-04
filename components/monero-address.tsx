"use client";

import { useEffect, useState } from "react";
import { Check, Copy, QrCode } from "lucide-react";

import { Button } from "@/components/ui/button";
import { COPY_FALLBACK_MESSAGE, copyToClipboard } from "@/lib/clipboard";
import { moneroUri } from "@/lib/support";

export function MoneroAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2_000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copy() {
    const ok = await copyToClipboard(address);
    setCopied(ok);
    setMessage(ok ? "" : COPY_FALLBACK_MESSAGE);
  }

  async function showQr() {
    if (qrDataUrl) {
      setQrDataUrl("");
      return;
    }
    try {
      // Generated in the browser from the bundled library, so displaying the QR
      // contacts no QR service and works with the network off.
      const QRCodeLibrary = (await import("qrcode")).default;
      setQrDataUrl(await QRCodeLibrary.toDataURL(moneroUri(address), {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 512,
      }));
      setMessage("");
    } catch {
      setMessage("The QR code could not be generated here. Copy the address instead.");
    }
  }

  return (
    <div>
      <p className="text-sm font-semibold">Monero (XMR)</p>
      <p
        className="mt-2 break-all rounded-2xl border border-border/70 bg-muted/50 p-4 font-mono text-xs leading-5"
        data-testid="monero-address"
      >
        {address}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button className="h-10 px-4" variant="outline" onClick={copy}>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? "Copied" : "Copy address"}
        </Button>
        <Button className="h-10 px-4" variant="outline" onClick={showQr} aria-expanded={qrDataUrl.length > 0}>
          <QrCode aria-hidden="true" />
          {qrDataUrl ? "Hide QR code" : "Show QR code"}
        </Button>
      </div>

      {qrDataUrl && (
        // A data URL keeps the generated QR inside this document.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="mt-4 w-full max-w-56 rounded-2xl border border-border bg-white p-3"
          src={qrDataUrl}
          alt="QR code containing the Monero donation address"
        />
      )}

      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        Check the first and last characters against this page before sending. A mistyped Monero address cannot be
        reversed or recovered.
      </p>
      <p className="mt-2 min-h-4 text-xs text-destructive" role="alert" aria-live="polite">{message}</p>
    </div>
  );
}
