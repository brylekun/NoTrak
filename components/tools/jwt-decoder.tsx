"use client";

import { useState } from "react";
import { Braces, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { decodeJwt, type DecodedJwt } from "@/lib/developer/jwt";

export function JwtDecoder() {
  const [token, setToken] = useState("");
  const [result, setResult] = useState<DecodedJwt | null>(null);
  const [message, setMessage] = useState("");

  function decode() {
    try { setResult(decodeJwt(token)); setMessage(""); }
    catch (reason) { setResult(null); setMessage(reason instanceof Error ? reason.message : "The token could not be decoded."); }
  }
  function reset() { setToken(""); setResult(null); setMessage(""); }

  return (
    <div>
      <div className="callout-warning"><strong>Decoding is not verification.</strong> Anyone can construct a token payload. NoTrak does not validate its signature, issuer, audience, or trustworthiness.</div>
      <label htmlFor="jwt-token" className="mt-6 block text-sm font-semibold">Compact JWT</label>
      <Textarea id="jwt-token" className="mt-2 min-h-36 break-all font-mono text-sm" value={token} onChange={(event) => { setToken(event.target.value); setResult(null); setMessage(""); }} placeholder="eyJhbGciOi..." spellCheck={false} />
      <div className="mt-5 flex flex-wrap gap-2"><Button className="h-10 px-4" onClick={decode}><Braces />Decode locally</Button>{(token || result) && <Button className="h-10 px-4" variant="outline" onClick={reset}><RotateCcw />Reset</Button>}</div>
      {result && <div className="mt-7 space-y-5 border-t border-border/70 pt-6" aria-live="polite"><div className="flex flex-wrap gap-2 text-xs"><span className="mode-local">Signature {result.signaturePresent ? "present, not verified" : "missing"}</span>{result.expiration && <span className={`rounded-full px-2.5 py-1 font-semibold ${result.expiration.expired ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>{result.expiration.expired ? "Expired" : "Not expired by exp"}</span>}{result.notBefore && !result.notBefore.active && <span className="rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-200">Not active by nbf</span>}</div><JsonBlock title="Header" value={result.header} /><JsonBlock title="Payload" value={result.payload} /></div>}
      <p className="mt-4 min-h-5 text-sm text-destructive" role="alert" aria-live="polite">{message}</p>
    </div>
  );
}

function JsonBlock({ title, value }: { title: string; value: Record<string, unknown> }) {
  return <section><h2 className="text-sm font-semibold">{title}</h2><pre className="mt-2 max-h-80 overflow-auto rounded-xl bg-muted/70 p-4 text-xs leading-5"><code>{JSON.stringify(value, null, 2)}</code></pre></section>;
}
