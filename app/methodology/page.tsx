import type { Metadata } from "next";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

export const metadata: Metadata = {
  title: "Methodology",
  description: "How NoTrak tools process data, calculate results, and communicate limitations.",
};

const methods = [
  {
    title: "Password safety",
    body: "Local analysis estimates strength from length, character variety, predictable sequences, repeated characters, and a small built-in common-password list. It is guidance, not a precise entropy or crack-time calculation. After separate confirmation, the optional Have I Been Pwned check calculates the provider-required SHA-1 identifier in the browser, sends only its first five hexadecimal characters directly to the fixed range endpoint, requests response padding, and compares the remaining characters locally. The password and full hash never leave the browser. A not-found result does not prove that a password is safe or unique.",
  },
  {
    title: "URL reputation",
    body: "Before any network request, NoTrak validates the URL and checks structural signals such as raw IP hosts, Punycode, mixed scripts, unusual ports, shortening services, excessive subdomains, and suspicious wording. After explicit confirmation, the full URL is sent through a no-store API route to configured Google Safe Browsing and URLhaus services. URLhaus specifically covers malware-distribution URLs, not general phishing. NoTrak never resolves, visits, renders, or downloads the submitted destination. A provider miss is never called safe.",
  },
  {
    title: "Malware reputation",
    body: "The browser calculates the selected file’s SHA-256 digest locally. After explicit confirmation, only the 64-character digest is sent through NoTrak to MalwareBazaar; the route rejects every other request shape and cannot accept file bytes. A not-found result means only that the provider did not recognize the hash at check time.",
  },
  {
    title: "Email header analysis",
    body: "A pasted header block is unfolded and parsed entirely in the browser, and parsing stops at the blank line so a pasted message body is never read as headers. The Received chain is reversed into delivery order, from the earliest hop NoTrak can see toward the recipient, with the address each receiving server actually recorded and the gap between consecutive dated hops. SPF, DKIM, and DMARC verdicts are read from Authentication-Results as the receiving server wrote them, falling back to Received-SPF only for a method that is otherwise absent. NoTrak does not validate a signature, query DNS, or check an SPF record, so a reported pass is only as trustworthy as the block it came from, and hops a sender writes themselves can be fabricated. Domain comparisons use a small bundled two-part suffix list and always show both domains, and a Return-Path on another domain is raised only when DMARC did not pass, because sending platforms use their own bounce domain routinely. Signals are weighted and explained rather than reduced to a verdict: a message sent from a genuinely compromised account produces a clean report, so a clean report is never presented as proof of legitimacy.",
  },
  {
    title: "Sensitive-data redaction",
    body: "Text is scanned locally for a conservative set of high-confidence patterns: email addresses, formatted phone numbers, IPv4 and IPv6 addresses, card-like numbers that pass the Luhn checksum, private-key blocks, JWTs, several documented token formats, assigned password or token values, and credentials or sensitive parameters inside HTTP URLs. Repeated exact values receive the same placeholder, and overlapping matches are resolved in favor of the more specific pattern. The detector deliberately does not guess names, street addresses, or unformatted phone numbers. A clean scan is not proof that text contains no personal information or secrets, so every sanitized result must still be reviewed before sharing.",
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
    title: "Private resume building",
    body: "Resume fields are held in tab memory and laid out locally using bundled fonts. The preview and exported PDF share the same measured lines and page breaks; PDF text remains selectable. Explicit draft downloads are unencrypted JSON files. No resume content is autosaved or uploaded. Supported scripts and page counts are bounded, and single-column formatting does not guarantee compatibility with every hiring system.",
  },
  {
    title: "PDF organization",
    body: "The browser copies selected pages into new PDF documents in the order and rotation shown. Combining, extracting, and splitting never change the selected originals or send them over the network. Page copying is not a lossless editor: digital signatures become invalid, and interactive forms, bookmarks, attachments, scripts, or other document-level features may not survive. Password-protected PDFs must be unlocked first.",
  },
  {
    title: "Local video processing",
    body: "The selected MP4 or WebM is held in browser memory and processed by a same-origin, single-thread WebAssembly build of FFmpeg. The source is never uploaded or fetched from a social platform. Trimming re-encodes a new H.264/AAC MP4, removes source metadata and chapters, and optionally center-crops, resizes, mutes, or adjusts volume. Thumbnail capture uses the browser canvas. File, duration, and pixel limits reduce memory failures, but encoding can still be slow or fail on resource-constrained devices, and estimated output sizes are not guarantees.",
  },
  {
    title: "Image processing",
    body: "Images are decoded and re-encoded through the browser Canvas API. The resizer can preserve the source aspect ratio or use exact dimensions, and it limits exports to 12,000 pixels per side and 40 megapixels to reduce browser memory failures. Metadata-cleaning exports are checked for supported metadata containers across JPEG marker segments, PNG chunks, and WebP RIFF chunks. Re-encoding does not remove information visibly present in pixels, discards embedded ICC color profiles, and may change compression or color handling.",
  },
  {
    title: "Image-to-text recognition",
    body: "The selected or pasted image is cropped and rotated through the browser Canvas API, then read by a bundled Tesseract.js WebAssembly engine and English recognition model. No image or recognized text is sent to an OCR service. The model reports an estimated confidence, but OCR can substitute characters, lose columns, and perform poorly on handwriting, blur, unusual fonts, or low contrast; important text must be checked against the original image.",
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
      <main id="main-content" tabIndex={-1} className="flex-1">
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
