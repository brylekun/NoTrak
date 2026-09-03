import type { Metadata } from "next";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

export const metadata: Metadata = {
  title: "Methodology",
  description: "How NoTrak tools process data, calculate results, and communicate limitations.",
};

const methods = [
  {
    title: "URL reputation",
    body: "Before any network request, NoTrak validates the URL and checks structural signals such as raw IP hosts, Punycode, mixed scripts, unusual ports, shortening services, excessive subdomains, and suspicious wording. After explicit confirmation, the full URL is sent through a no-store API route to configured Google Safe Browsing and URLhaus services. URLhaus specifically covers malware-distribution URLs, not general phishing. NoTrak never resolves, visits, renders, or downloads the submitted destination. A provider miss is never called safe.",
  },
  {
    title: "Malware reputation",
    body: "The browser calculates the selected file’s SHA-256 digest locally. After explicit confirmation, only the 64-character digest is sent through NoTrak to MalwareBazaar; the route rejects every other request shape and cannot accept file bytes. A not-found result means only that the provider did not recognize the hash at check time.",
  },
  {
    title: "QR scanning and JWT decoding",
    body: "Selected QR images and camera frames are decoded locally; camera access starts only after a button press, and decoded links are never opened automatically. JWTs are Base64URL-decoded locally as untrusted JSON. No signature, issuer, audience, or authenticity verification is performed.",
  },
  {
    title: "File encryption",
    body: "NoTrak v2 containers use AES-256-GCM authenticated encryption. A unique 16-byte salt and 12-byte IV are generated for every file, and PBKDF2-HMAC-SHA-256 derives the key using 600,000 iterations. The authenticated cleartext header stores only the format version, work factor, salt, and IV; the original filename is encrypted with the file contents. Legacy v1 containers still decrypt, but they stored the filename in their authenticated cleartext header. Forgotten passwords cannot be recovered.",
  },
  {
    title: "Browser privacy check",
    body: "The check reports a small set of properties an ordinary page can observe after it loads. The surface rating counts available signals and credits reported privacy preferences. It is educational—not a uniqueness study, tracker scan, or proof of anonymity.",
  },
  {
    title: "Connection speed",
    body: "After explicit activation, the browser sends small zero-byte latency probes followed by adaptive download and upload measurements directly to Cloudflare’s speed endpoints. Idle latency uses the Resource Timing interval from request start to response start after discarding connection warm-up and statistical outliers. The test ramps to larger synthetic payloads only while earlier requests are too short to characterize the connection, with disclosed maximum transfer sizes. Unavailable values are not presented as zero. Each run is rated complete, partial, or variable: partial means a value had too few valid samples or a measurement failed, and variable means every value arrived but the samples disagreed enough (measured as the interquartile range over the median) that the true figure is a range rather than one number. Packet-loss testing, credentials, and Cloudflare’s aggregate result-logging endpoint are disabled.",
  },
  {
    title: "PDF metadata cleaning",
    body: "The browser removes standard document-information fields and catalog XMP metadata, saves a new PDF, reopens it, and verifies those fields are absent. Pages and visible content are preserved, but visible names, annotations, attachments, layers, and document text are not redacted.",
  },
  {
    title: "Image processing",
    body: "Images are decoded and re-encoded through the browser Canvas API. The exported copy is checked for supported metadata containers across JPEG marker segments, PNG chunks, and WebP RIFF chunks. Re-encoding does not remove information visibly present in pixels, discards embedded ICC color profiles, and may change compression or color handling.",
  },
  {
    title: "Offline availability",
    body: "A service worker caches NoTrak\u2019s own pages and static assets so local tools can keep running without a network, demonstrating that their core processing does not depend on a server. The cache holds only NoTrak\u2019s files: no tool input, output, or selected file is written to it, cross-origin requests are left untouched, and the IP and reputation routes are excluded so a personalized response is never stored or replayed. Pages are fetched from the network first whenever one is available, so a cached copy does not normally hide an update.",
  },
  {
    title: "Random generation and hashing",
    body: "Passwords, passphrases, and UUIDs use the browser’s cryptographically secure random generator. Hashes use Web Crypto SHA-256, SHA-384, or SHA-512. Hashes are fingerprints, not encryption, and cannot protect readable content by themselves.",
  },
];

export default function MethodologyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
          <p className="eyebrow">Methodology</p>
          <h1 className="mt-3 max-w-3xl text-balance text-4xl font-semibold tracking-[-0.05em] sm:text-6xl">Clear methods. Honest limits.</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">NoTrak explains what each result means, what leaves your device, and what the tool cannot guarantee.</p>

          <div className="mt-12 grid gap-4 md:grid-cols-2">
            {methods.map((method) => (
              <section key={method.title} className="rounded-3xl border border-border/80 bg-card p-6">
                <h2 className="text-lg font-semibold tracking-[-0.025em]">{method.title}</h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{method.body}</p>
              </section>
            ))}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
