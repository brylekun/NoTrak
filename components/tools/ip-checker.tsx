"use client";

import { useState } from "react";
import { LoaderCircle, MapPin, Network } from "lucide-react";

import { Button } from "@/components/ui/button";

type IpResult = {
  ip: string | null;
  ipVersion: 4 | 6 | null;
  country: string | null;
  region: string | null;
  city: string | null;
  timezone: string | null;
};

export function IpChecker() {
  const [result, setResult] = useState<IpResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function checkConnection() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/ip", { cache: "no-store" });
      if (!response.ok) throw new Error("The connection check is temporarily unavailable.");
      setResult((await response.json()) as IpResult);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The connection check failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {!result ? (
        <div className="text-center sm:text-left">
          <h2 className="text-lg font-semibold">Check this connection</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            NoTrak reads the address already visible to the website and returns available approximate location headers.
          </p>
          <Button className="mt-6 h-10 px-4" onClick={checkConnection} disabled={loading}>
            {loading && <LoaderCircle className="animate-spin" aria-hidden="true" />}
            {loading ? "Checking…" : "Show my IP"}
          </Button>
        </div>
      ) : (
        <div aria-live="polite">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <Network className="size-4" aria-hidden="true" />
            Public address
          </div>
          <p className="mt-3 break-all font-mono text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
            {result.ip ?? "Unavailable locally"}
          </p>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <ResultItem label="IP version" value={result.ipVersion ? `IPv${result.ipVersion}` : "Unavailable"} />
            <ResultItem
              label="Approximate location"
              value={[result.city, result.region, result.country].filter(Boolean).join(", ") || "Unavailable"}
              icon={<MapPin className="size-4" aria-hidden="true" />}
            />
            <ResultItem label="Timezone" value={result.timezone ?? "Unavailable"} />
            <ResultItem label="Accuracy" value="Approximate only" />
          </div>
          <Button className="mt-6" variant="outline" onClick={checkConnection} disabled={loading}>
            Check again
          </Button>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-destructive" role="alert">{error}</p>}
    </div>
  );
}

function ResultItem({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/35 p-4">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">{icon}{label}</p>
      <p className="mt-1.5 text-sm font-semibold">{value}</p>
    </div>
  );
}
