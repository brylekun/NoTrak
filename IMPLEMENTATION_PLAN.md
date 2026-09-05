# NoTrak — Implementation Plan

## 1. Product goal

Build **NoTrak**, a public, privacy-first utility website for ordinary users. Most work happens in the visitor's browser; Vercel serves the Next.js application and only three small API routes.

**Core promise:** no accounts, database, cloud file storage, saved history, analytics trackers, or server-side file processing.

**Tagline:** Private tools. Nothing stored.

## 2. Scope and constraints

- Host on **Vercel Hobby** as a personal/non-commercial project.
- Use **Next.js (App Router), TypeScript, Tailwind CSS, and shadcn/ui**.
- Keep files, passwords, passphrases, encryption keys, and generated results on-device.
- Prefer Web Platform APIs over large dependencies.
- Use API routes only when a request header or secret third-party API key is required.
- Do not add authentication, a database, object storage, user profiles, or cloud history.
- Do not include temporary email, file sharing, proxy/VPN features, or AI analysis in this project. Password breach checking is limited to the k-anonymous, browser-direct HIBP range protocol after explicit confirmation.
- Give every tool a dedicated, indexable `/tools/...` page; do not make tools modal-only.
- Review Vercel and third-party service limits and terms before public launch or monetization.

## 3. Architecture

```text
Visitor
  |
  +-- Vercel-hosted Next.js app
        |
        +-- Browser-only tools
        |     File API, Web Crypto, Canvas, Web Workers/WASM as needed
        |     Input -> local processing -> local result/download
        |
        +-- Explicit browser-direct lookup
        |     Password -> local SHA-1 -> five-character prefix -> HIBP range API
        |     Full hash suffix is compared locally; password/full hash never leave
        |
        +-- Small server routes
              /api/ip                 -> request/Vercel headers
              /api/security/url       -> threat-intelligence providers
              /api/security/file-hash -> MalwareBazaar

No accounts | No database | No file uploads | No cloud storage
```

The browser must calculate a selected file's SHA-256 digest before a malware lookup. Only the hash may be sent. The URL checker may send the submitted URL to third-party reputation services, but it must never visit, render, resolve, or download the submitted URL itself.

## 4. Proposed project structure

```text
app/
  layout.tsx
  page.tsx
  manifest.ts                       # installable PWA manifest
  offline/page.tsx                  # service-worker navigation fallback
  error.tsx                         # route-level boundary; never renders error detail
  global-error.tsx                  # root-layout fallback with its own <html>
  not-found.tsx
  sitemap.ts                        # generated from the registry
  robots.ts
  privacy/page.tsx
  tools/
    page.tsx                        # searchable, category-filtered index
    [slug]/page.tsx                 # optional registry-driven shared route
    whats-my-ip/page.tsx
    speed-test/page.tsx
    tracking-url-cleaner/page.tsx
    remove-exif/page.tsx
    image-compressor/page.tsx
    image-resizer/page.tsx
    image-to-text/page.tsx
    password-generator/page.tsx
    password-safety/page.tsx
    sensitive-data-redactor/page.tsx
    passphrase-generator/page.tsx
    file-encryption/page.tsx
    hash-generator/page.tsx
    qr-generator/page.tsx
    browser-privacy/page.tsx
    pdf-metadata-cleaner/page.tsx
    pdf-toolkit/page.tsx
    phishing-checker/page.tsx
    malware-reputation/page.tsx
  api/
    ip/route.ts
    security/
      url/route.ts
      file-hash/route.ts
components/
  layout/
  seo/json-ld.tsx                  # safely serialized structured-data blocks
  tool-shell.tsx
  tool-card.tsx
  tool-browser.tsx                 # client search/filter for the tools index
  privacy-notice.tsx
  result-state.tsx
  ui/                              # shadcn/ui components
lib/
  seo/structured-data.ts           # WebSite and tool breadcrumb schemas
  site.ts                          # single resolved public origin
  clipboard.ts                     # clipboard writes with a definite outcome
  theme.ts                         # three-state preference; absent means system
  tools/registry.ts
  tools/guides.ts                  # useful per-tool guidance and related links
  tools/icons.ts
  tools/metadata.ts
  images/metadata.ts               # JPEG/PNG/WebP metadata container detection
  images/exif.ts                   # grouped EXIF report, location flagged
  images/ocr.ts                    # OCR input, crop, rotation, and output boundaries
  security/provider-status.ts      # failure taxonomy and its wording
  security/client.ts               # normalized API errors for the browser
  crypto/
  images/
  pdf/
  network/
  security/
  validation/
public/
tests/
  unit/
  integration/
  e2e/
```

`lib/tools/registry.ts` is the single source of truth for each tool's slug, name, description, category, processing mode (`local` or `external-lookup`), status, privacy notice, and optional `featured` flag. Use it to populate navigation, the `/tools` index and its category filter, homepage cards, per-page metadata, and `sitemap.xml`. `lib/site.ts` resolves the single public origin used for canonical URLs, social cards, the sitemap, and robots.

## 5. Tool roadmap

### V1 launch set (13 tools)

| Tool | Processing | Notes |
|---|---|---|
| What's My IP | `/api/ip` | IP plus available approximate Vercel geolocation headers; no ISP/VPN claims |
| Speed Test | Browser + Cloudflare endpoints | Download, upload, ping, jitter, loaded latency; never proxy traffic through Vercel |
| Tracking URL Cleaner | Browser | Remove known tracking parameters; preview before copy |
| EXIF Metadata Remover | Browser | Re-encode safely and let the user download a new file |
| Image Compressor | Browser | Canvas or a focused client library; preserve the original |
| Password Generator | Browser | `crypto.getRandomValues()` only |
| Passphrase Generator | Browser | Bundled word list and cryptographically secure selection |
| File Encryption / Decryption | Browser | Versioned file format; AES-GCM; password-derived key |
| Hash Generator | Browser | SHA-256, SHA-384, SHA-512; stream/chunk where supported |
| QR Generator | Browser | Text/URL input; downloadable output |
| Browser Privacy Check | Browser | Explain observable exposure; never claim the user is anonymous |
| PDF Metadata Cleaner | Browser | Remove document metadata locally; warn that visible content is unchanged |

### V1.1

| Tool | Processing | Notes |
|---|---|---|
| Phishing / Malicious URL Checker | Local analysis + `/api/security/url` | Risk explanation, evidence, and uncertainty; never label a URL guaranteed safe |
| Malware Reputation Checker | Local SHA-256 + `/api/security/file-hash` | Send hash only; unknown does not mean safe |
| QR Scanner | Browser | Camera/file permission only when the user starts scanning |
| Image Converter | Browser | Explicit supported input/output formats |
| UUID Generator | Browser | Use `crypto.randomUUID()` with a compatible fallback if required |
| JWT Decoder | Browser | Decode only; clearly state that decoding does not verify a signature |

### V1.2 — Experience and reliability

V1.2 is primarily a quality release. It strengthens the existing 18 tools and adds four local-only utilities without expanding NoTrak's privacy boundary beyond the browser.

| Workstream | Scope | Acceptance boundary |
|---|---|---|
| Light and dark themes | System-aware initial theme, accessible manual toggle, locally persisted preference, and a cohesive NoTrak palette | No initial theme flash; both themes remain readable across the homepage, tool shells, forms, results, warnings, and downloads |
| Tool discovery | A dedicated `/tools` index with category filtering and search, plus a curated homepage subset | Every released tool is reachable and filterable; the homepage stays scannable as the toolkit grows |
| Discoverability | Explicit favicon signals, canonical URLs, social cards, honest `sitemap.xml` entries, `robots.txt`, WebSite/Breadcrumb structured data, and crawlable per-tool guides | Each released tool page is individually indexable, explains its use and limits, and links to relevant tools; a new tool cannot pass the registry tests without guide content |
| Failure and recovery surfaces | Route-level error boundary, root boundary, 404 page, and definite clipboard outcomes | A thrown tool error or blocked browser API produces NoTrak-framed guidance rather than a silent no-op or a default error screen |
| External-lookup resilience | Clear rate-limit, quota, timeout, authentication, and provider-outage states | Failures never become a `safe` result, reveal upstream details, or disable available local analysis |
| Speed Test confidence | Explain unstable samples and distinguish complete, partial, and variable measurements | Results do not imply laboratory precision and remain useful when a browser or network produces incomplete samples |
| Accessibility and responsive QA | Keyboard, focus, screen-reader status, contrast, reduced-motion, zoom, and mobile checks | All released pages meet the agreed accessibility target without horizontal overflow or color-only meaning |
| Release regression coverage | Expand browser tests around themes, reset/error paths, local-only network boundaries, and representative downloads | CI catches privacy, accessibility, responsive-layout, and critical workflow regressions before promotion |
| Offline availability | Installable manifest and a service worker that caches only NoTrak's own pages and assets | Local tools keep working with the network off; no tool input and no `/api` response is ever cached |
| Correctness of privacy claims | Every scored or verified claim must be backed by what the code actually measures | A displayed score responds to real changes; a "verified" or "protected" claim is proven by a test |

Implementation status: implemented — the system-aware three-state theme, the `/tools` index, registry-driven SEO surfaces, WebSite and breadcrumb structured data, honest sitemap metadata, per-tool practical guides and related links, the error/404/root boundaries, shared disclosure callouts, the reduced-motion guard, HSTS, the external-lookup failure taxonomy, the Speed Test confidence rating, offline support, the honest exposure score, encrypted-filename containers, container-aware image metadata detection, the expanded tracking-parameter rules, batch image cleaning with drag-and-drop, and four new local tools. Pending: the full manual accessibility audit (keyboard, screen reader, 200% zoom, physical devices) and the nonce-based CSP, which is deferred by decision — see below.

V1.2 also adds four local-only tools, bringing the released set to 22:

| Tool | Processing | Notes |
|---|---|---|
| EXIF Viewer | Browser | Shows camera, timestamp, and GPS data; coordinates are never sent to a map service |
| Base64 Converter | Browser | Standard and URL-safe alphabets; states plainly that Base64 is not encryption |
| JSON Formatter | Browser | Format, minify, sort keys, and report the error location without echoing the document |
| Text Encryption | Browser | AES-256-GCM with a pasteable armored block, reusing the file container's primitives |

Possible later local-only additions: user-agent analyzer, username generator, and synthetic test identity generator.

### V1.3 — Password safety, image resizing, and PDF organization

V1.3 adds a Password Safety Checker, local Image Resizer, and Private PDF Toolkit, bringing the released set to 25. Password analysis checks length, character variety, predictable sequences, repeated characters, and a small bundled common-password list without transmitting the input. Its optional breach-corpus check runs only after separate confirmation: the browser calculates the SHA-1 identifier required by Have I Been Pwned, sends only its first five hexadecimal characters directly to the fixed range endpoint, requests padded results, and compares the suffix locally. The password and full hash never leave the browser, and a miss is never described as proof of safety. Image resizing also stays in-browser, supports locked or exact dimensions and multiple output formats, and applies explicit dimension and megapixel limits before allocating the export canvas. PDF organization runs in a worker and lets visitors merge, extract, reorder, rotate, remove, or split pages without uploading the source documents; its interface discloses that document-level features and signatures may not survive page copying.

### V1.4 — Local email header analysis

| Tool | Processing | Notes |
|---|---|---|
| Email Header Analyzer | Browser | Parses a pasted header block locally; explains delivery hops, reported authentication, and sender mismatches |

V1.4 adds the Email Header Analyzer, bringing the released set to 26. It fills the gap between the Phishing Checker, which inspects a suspicious link, and the message that carried it. Header blocks contain recipient names, internal hostnames, and the originating IP address, and the common web analyzers are paste-to-server forms, so this parses entirely in the browser with no network request, no new dependency, and no provider notice. The report unfolds every field, orders the `Received` chain from the earliest visible hop toward the recipient with per-hop delays, extracts the originating address and marks private ranges, and parses `Authentication-Results` (falling back to `Received-SPF` only when it adds a method that is otherwise absent).

Two honesty constraints are enforced in code and covered by tests. Authentication verdicts are reported as written by the receiving server: the tool never validates a signature or queries DNS, and the interface says so. A clean report is never presented as proof of legitimacy, because a message sent from a genuinely compromised account produces one. Signals are weighted and explained rather than reduced to a verdict, and heuristics that legitimately fire on normal mail are scoped accordingly — a `Return-Path` on a different domain is raised only when DMARC did not pass, and organizational-domain comparison uses a small bundled two-part suffix list whose wording always shows both domains for the reader to judge.

### V1.5 — Local sensitive-data redaction

| Tool | Processing | Notes |
|---|---|---|
| Sensitive Data Redactor | Browser | Finds conservative high-confidence patterns, lets the visitor review each masked finding, and creates a sanitized copy locally |

V1.5 adds the Sensitive Data Redactor, bringing the released set to 27. It accepts pasted text or a bounded plain-text file, finds supported personal and credential patterns without sending the input anywhere, groups repeated exact values under one consistent placeholder, and lets the visitor exclude any finding before copying or downloading the sanitized result. Payment-card candidates must pass the Luhn checksum; known token, private-key, JWT, URL-secret, email, IP, and formatted-phone patterns are resolved without overlapping replacements.

The tool is deliberately honest about its limits. It does not guess names, street addresses, or unformatted phone numbers, masked previews avoid needlessly echoing complete findings, and a zero-result scan is never described as proof that the text is safe to share. Input is capped at one million characters and selected files at 5 MB.

### V1.6 — Local image-to-text recognition

| Tool | Processing | Notes |
|---|---|---|
| Image to Text | Browser | Crops and rotates a screenshot or photo, then extracts editable English text with bundled OCR assets |

V1.6 adds Image to Text, bringing the released set to 28. Visitors can choose, drop, or paste a JPEG, PNG, or WebP image, crop it with exact pixel bounds, rotate it in quarter turns, and recognize printed English text locally. The Tesseract.js worker, compatible WebAssembly cores, and compact English model are copied from pinned packages into same-origin build assets, so recognition never sends the image to an OCR provider. The first run loads roughly 10 MB of application assets, which the service worker may cache for later offline use.

The result remains editable and can be copied, downloaded as text, or taken to the Sensitive Data Redactor. The interface reports model confidence only as an estimate and requires the visitor to verify important text against the original. Files are capped at 15 MB and 40 megapixels to bound browser memory use; the first version supports printed English rather than handwriting or multilingual recognition.

### V1.7 — Private Resume Builder

The 29th tool adds a browser-only resume editor with contact details, summary, experience, education, skills, and projects. Visitors can hide sections, reorder sections and entries, switch Classic/Compact templates and A4/Letter paper sizes, and view actual page boundaries. One measured layout drives both the SVG preview and selectable-text PDF export with safe HTTP(S) and email link annotations. No watermark or ATS compatibility guarantee is added.

Drafts can be explicitly downloaded and reopened as versioned JSON files; no resume content is automatically persisted or uploaded. Imports validate schema, unique IDs, field lengths, a 256 KB file limit, and 40,000 total serialized characters. The editor warns about unsaved work and confirms destructive replacements. Exports cap output at eight pages and twelve entries per section. Same-origin OFL-licensed Noto Sans fonts are bundled, and unsupported characters produce a visible error instead of silent glyph loss.

Implementation files: `app/tools/resume-builder/page.tsx`, `components/tools/resume-builder.tsx`, `lib/resume/model.ts`, `lib/resume/pdf.ts`, and `public/fonts/resume/`. Release verification covers draft roundtrips, page wrapping, hidden/reordered sections, PDF links and text, desktop/mobile previews, and no processing requests. Production deployment and live smoke checks remain operator steps after commit/push approval.

Local verification: lint, typecheck, and the production build pass; 302 unit tests and all 55 Chromium browser tests pass. Classic, Compact, and a two-page export were rendered and visually inspected, and PDF text was extracted successfully. The browser checks cover desktop/mobile layout and an offline edit/export after assets load. Firefox and WebKit were not run for this change because their matching browser binaries are not installed on this host; those checks remain for CI or a suitably provisioned host.

### V1.8 — Private Video Toolkit

The 30th tool adds local preparation for videos the visitor owns. It accepts browser-readable MP4 and WebM inputs, trims a selected range, exports H.264/AAC MP4 at 720p or 1080p, offers original, 16:9, 1:1, 4:5, and 9:16 framing, and supports high/balanced/smaller-file compression, audio removal, volume adjustment, and JPEG thumbnail capture. Center-crop and upscaling warnings remain visible, and the output-size estimate is explicitly approximate.

Processing uses a lazily loaded, same-origin, single-thread FFmpeg WebAssembly engine and never sends the source or result to NoTrak, a social platform, or a conversion provider. The original is untouched. Inputs are capped at 75 MB, 3 minutes, 4K, and 8.3 megapixels to reduce browser-memory failures. The interface warns that local encoding may take longer than the clip and supports cancellation. The 31 MB engine is excluded from the service worker cache so a visitor does not silently lose that storage; it remains active in memory for repeated work in the same tab.

Implementation files: `app/tools/video-toolkit/page.tsx`, `components/tools/video-toolkit.tsx`, `lib/video/toolkit.ts`, and `scripts/prepare-video-assets.mjs`. Release checks cover file and metadata limits, output dimensions and arguments, trim validation, safe names, actual local MP4 output, thumbnail export, no processing request, mobile layout, cancellation, metadata removal, and the unchanged wider release suite.

Local verification: lint, typecheck, production build, and production dependency audit pass; 315 unit tests and all 59 Chromium browser tests pass. The browser tests exercise a real WebM-to-H.264 MP4 conversion, JPEG thumbnail export, cancellation, the same-origin CSP boundary, source metadata removal, mobile layout, offline behavior, and every released tool shell. Firefox and WebKit remain CI checks because their matching browser binaries are not installed on this host.

## 6. API contracts

### `GET /api/ip`

Return only normalized fields that are available:

```json
{
  "ip": "203.0.113.1",
  "ipVersion": 4,
  "country": "NL",
  "region": "NH",
  "city": "Amsterdam",
  "timezone": "Europe/Amsterdam"
}
```

Mark location as approximate. Use `Cache-Control: private, no-store`. Do not log the returned values in application code.

### `POST /api/security/url`

Request: `{ "url": "https://example.com/path" }`

1. Validate with Zod; accept only `http:` and `https:` URLs.
2. Reject credentials, malformed input, oversized input, and unsupported schemes.
3. Perform deterministic local-style checks without fetching the destination: raw IP host, punycode, unusual port, excessive subdomains, `@`, suspicious keywords, shortener, encoded/very long host, HTTP, and mixed-script/lookalike indicators.
4. Query configured Google Safe Browsing and URLhaus endpoints with strict timeouts.
5. Return provider status, matched threats, local signals, an explainable risk level/score, and warnings when a provider is unavailable.

Never turn a provider miss into a `safe` guarantee. Use `Cache-Control: no-store`. Do not include secrets or raw upstream errors in responses.

### `POST /api/security/file-hash`

Request: `{ "sha256": "<64 lowercase hex characters>" }`

Validate the exact format, query MalwareBazaar, normalize its response, and return `known_malicious`, `not_found`, or `provider_unavailable` plus available family/signature/first-seen details. Never accept file bytes. The UI must say: **File uploaded: No. Data sent: SHA-256 hash only.**

## 7. External services and dependencies

| Service/library | Purpose | Boundary |
|---|---|---|
| Vercel | Hosting, functions, request/geolocation headers | Hobby limits and allowed use must be checked before launch |
| `@cloudflare/speedtest` | Browser-side speed measurements | Test payload goes between the browser and Cloudflare, not Vercel |
| Google Safe Browsing | Known malicious/phishing URL lookup | Server-only key; confirm current eligibility and terms |
| URLhaus | Malicious URL intelligence | Confirm current API/auth, attribution, and rate limits |
| MalwareBazaar | SHA-256 reputation | Hash only; confirm current API/auth, attribution, and rate limits |
| Have I Been Pwned Pwned Passwords | K-anonymous password breach lookup | Browser-direct after confirmation; five-character SHA-1 prefix only; request padding; no key |
| Web Crypto API | Randomness, hashing, AES-GCM | Preferred native browser implementation |
| `pdf-lib` | Local PDF metadata editing | Dynamically import on relevant tool page |
| `exifr` | Local image metadata reading when needed | Dynamically import; removal should be verified after export |
| QR library + scanner | Local QR creation/scanning | Keep permissions and data in-browser |
| Zod | Shared input/output validation | Validate both API boundaries and complex form data |

Avoid VirusTotal as the primary public backend unless its current licensing and quota explicitly permit the intended use.

## 8. Environment variables

Create `.env.example` with names only:

```dotenv
GOOGLE_SAFE_BROWSING_API_KEY=
MALWAREBAZAAR_API_KEY=
URLHAUS_AUTH_KEY=
NEXT_PUBLIC_SITE_URL=
```

`NEXT_PUBLIC_SITE_URL` is the only public variable. It holds no secret and only sets the canonical origin used by metadata, `sitemap.xml`, and `robots.txt`; `lib/site.ts` falls back to the Vercel-provided domain and then to `localhost`.

Only add variables actually required by the providers' current APIs. Configure secrets in Vercel for Preview and Production. Never prefix secrets with `NEXT_PUBLIC_`, expose them to client components, return them in errors, or write them to logs.

## 9. Security and privacy requirements

- Default to client components only where browser APIs or interactivity require them.
- Never upload user files, plaintext, passwords, passphrases, encryption keys, decrypted data, or generated credentials.
- Do not persist sensitive inputs in `localStorage`, `sessionStorage`, IndexedDB, URLs, analytics, or error reports. Store only harmless preferences locally and document them.
- Clear sensitive component state when the user resets or leaves a tool where practical.
- Use `crypto.getRandomValues()`/`crypto.randomUUID()`; never use `Math.random()` for security-sensitive output.
- Encrypt with authenticated encryption (AES-GCM), a unique random salt and IV, an explicit version header, and a strong password KDF. Never reuse an IV with the same key.
- Run expensive file operations in Web Workers where needed; impose clear browser-side file-size limits and fail safely.
- Validate file signatures/types rather than trusting extensions. Never execute, preview as active HTML, or upload supplied content.
- Protect API routes with strict schemas, body-size limits, timeouts, normalized errors, and rate controls available without adding a user database.
- The URL route must not fetch user-supplied destinations or perform unrestricted redirects, preventing SSRF and tracking surprises.
- Set a restrictive Content Security Policy and standard security headers; keep third-party origins limited to those required by the active tool.
- Use `no-store` on personalized or reputation responses. Avoid application logs containing IPs, URLs, hashes, or request bodies; disclose that hosting/providers may retain operational logs under their own policies.
- Show a standard notice on every tool: **Processed locally** or **External lookup**, with the exact data that leaves the device.
- Encrypt filenames as well as file contents; a container's cleartext header must not reveal what was encrypted.
- The service worker may cache only NoTrak's own pages and static assets. Never cache an `/api` response, a cross-origin request, or any response marked `no-store`.
- A displayed score or verification must reflect what the code actually measures. Do not present a constant as a measurement, and do not claim "verified" beyond what was checked.
- Use careful claims: `not found`/`unknown` is not `safe`; an exposure score is not proof of anonymity; IP location is approximate.

## 10. Phased implementation order

### Phase 0 — Foundation

1. Scaffold Next.js with strict TypeScript, Tailwind, ESLint, and shadcn/ui.
2. Add the tool registry, shared tool shell, privacy notice, result states, error boundary, metadata helpers, responsive navigation, and accessible theme.
3. Add unit, integration, and browser-test setup plus CI for lint, typecheck, tests, and build.
4. Add privacy and methodology pages; state clearly when external providers receive data.

### Phase 1 — Establish the pattern

Build the site shell and the first three tools:

1. What's My IP
2. Password Generator
3. Tracking URL Cleaner

This milestone validates both processing modes, page conventions, privacy messaging, error states, and deployment.

### Phase 2 — Low-risk browser tools

Build Hash Generator, Passphrase Generator, UUID Generator, QR Generator, EXIF Remover, and Image Compressor. Add Web Workers and dynamic imports where bundle or CPU cost warrants them.

### Phase 3 — Advanced local tools and V1 launch

Build File Encryption/Decryption, Browser Privacy Check, Speed Test, and PDF Metadata Cleaner. Complete accessibility, cross-browser, performance, privacy-copy, and production deployment checks. Launch when all 13 V1 tools meet their acceptance criteria. UUID Generator is included in V1 through Phase 2.

### Phase 4 — Security intelligence and V1.1

Add Phishing Checker and Malware Reputation Checker only after provider accounts, terms, quotas, abuse controls, failure modes, and disclosures are confirmed. Then add QR Scanner, Image Converter, UUID Generator if not already shipped, and JWT Decoder.

Implementation status: the five V1.1 tools and guarded provider adapters are implemented. Reputation providers remain inactive until server-only credentials are configured and the operator completes the provider approval and Preview validation gates. UUID Generator was already shipped in Phase 2.

### V1.1 release phase — Activation and production promotion

Add the repeatable release gate, production browser smoke tests, dependency auditing, explicit Function duration limits, provider-credential validation, and the Preview-to-Production runbook. Then complete the external gates in order: provider approval, Preview credentials, protected Preview deployment, live provider validation, Vercel Firewall rate limiting, manual device/accessibility QA, and human-approved production promotion.

Implementation status: repository-side release automation and documentation are implemented. Vercel linking, provider credentials, live quota validation, Firewall configuration, physical-device QA, and production promotion require operator access and remain pending until completed against a real deployment.

### Phase 5 — V1.2 experience and reliability

1. Add a system-aware theme with a three-state toggle (System, Light, Dark). Storing nothing means "follow the system", so an explicit override can always be undone.
2. Add a `/tools` index that filters the registry by category and searches name and description, and reduce the homepage to a curated `featured` subset.
3. Generate `sitemap.xml`, `robots.txt`, canonical URLs, and Open Graph/Twitter metadata from the registry and a single resolved site origin.
4. Add `app/error.tsx`, `app/global-error.tsx`, and `app/not-found.tsx`. Never render or transmit error details, because a tool error can carry a filename, URL, or hash.
5. Give every clipboard write a definite outcome with a manual-copy fallback, promote the repeated disclosure panels to shared `callout-*` classes, add a global `prefers-reduced-motion` guard, and send HSTS.
6. Refine every external-lookup failure state so rate limits, quotas, timeouts, invalid credentials, and upstream outages are distinguishable and non-alarming, and never resolve to a `safe` result.
7. Add a Speed Test result-quality rating of complete, partial, or variable, based on sample completeness and on the interquartile spread of the samples.
8. Correct the Browser Privacy Check exposure score: count a surface only when the browser actually reveals it, so a withheld value, a disabled capability, and a zero reading all read as non-exposure.
9. Move the original filename out of the encrypted container's cleartext header into the AES-GCM plaintext (format v2), keeping v1 readable and telling the visitor when a v1 file exposed its name.
10. Replace the single-marker EXIF byte scan with real container parsing across JPEG marker segments, PNG chunks, and WebP RIFF chunks, and disclose that re-encoding drops the ICC profile.
11. Expand the tracking-parameter rules with host-scoped parameters, query-shaped `#fragment` cleaning, and referral path segments.
12. Add an installable manifest and a service worker so local tools keep working offline. Cache only NoTrak's own pages and assets; never cache an `/api` response or a cross-origin request.
13. Add the remaining local-only tools: EXIF Viewer, Base64 Converter, JSON Formatter, and Text Encryption. Add batch processing and drag-and-drop where files are involved.
14. Audit every released tool in light and dark themes for contrast, keyboard access, visible focus, status announcements, 200% zoom, reduced motion, and mobile layout.
15. Run the full repository gate, protected Preview QA, physical-device checks, and human-approved Production promotion before tagging `v1.2.0`.

Implementation status: steps 1–13 are implemented and verified with 207 unit tests and 36 browser-test definitions. The current Chromium and Firefox run produced 70 passes and two documented engine-specific skips. Steps 14–15 remain pending because they need physical devices, assistive technology, and a real deployment.

WebKit smoke tests could not run in this environment: the host is missing `libicu74`, `libxml2`, and `libflite1`. Safari coverage needs a machine with those libraries, or CI. Two browser tests are skipped on Firefox because Playwright's Firefox build does not apply `colorScheme` emulation to `matchMedia` and its offline emulation does not block top-level navigations; both behaviours are verified on Chromium.

### Phase 6 — V1.3 password safety, image resizing, and PDF organization

1. Add a local password-strength estimate with honest warnings and suggestions; do not claim a precise crack time or proof of safety.
2. Add the optional HIBP Pwned Passwords range lookup behind a separate disclosure and confirmation. Hash in the browser, transmit only the five-character prefix directly to the fixed endpoint, request padding, and compare the suffix locally.
3. Add unit and browser coverage proving that local analysis makes no request and the external lookup never sends a password or full hash. Update privacy, methodology, provider, CSP, registry, sitemap, and offline-cache integration.
4. Add a local Image Resizer with aspect-ratio locking, percentage presets, exact dimensions, format and quality controls, safe canvas limits, an upscaling warning, and a verified download workflow.
5. Add a worker-backed Private PDF Toolkit that merges, extracts, reorders, rotates, removes, and splits pages locally, with bounded file/page limits and explicit warnings about signatures and document-level features.

Implementation status: implemented and verified with 226 unit tests and 43 browser-test definitions. All 84 applicable Chromium and Firefox checks passed, with two documented engine-specific skips; one unrelated Firefox 404 navigation timed out in the full run and passed immediately on its isolated retry. The browser checks prove that local password analysis makes no HIBP request, the confirmed lookup sends only the padded five-character prefix request with no body, image resizing produces the requested dimensions without a processing request, and PDF pages can be reordered, rotated, removed, rebuilt, downloaded, and reopened without a processing request.

### Phase 7 — V1.4 local email header analysis

1. Parse pasted header fields, authentication results, addresses, and delivery hops locally with strict input limits.
2. Explain reported evidence and sender mismatches without presenting a pass or clean report as verification.
3. Prove the workflow makes no request, document the limitations, and add the tool to registry-driven discovery and SEO surfaces.

Implementation status: implemented.

### Phase 8 — V1.5 local sensitive-data redaction

1. Add conservative detectors for supported personal details, payment-card candidates, credentials, private keys, JWTs, and URL secrets.
2. Group repeated values, mask review previews, allow each finding to be included or excluded, and produce copyable and downloadable sanitized text.
3. Accept bounded plain-text files, reject binary content, and prove the entire workflow makes no processing request.
4. Document that detection is incomplete by design and that a clean scan never proves text is safe to share.

Implementation status: implemented and verified with 277 unit tests and 48 browser-test definitions. All 94 applicable Chromium and Firefox checks passed, with the same two documented Firefox engine-specific skips described above. The browser workflow proves that reviewing, selecting, redacting, copying, and downloading sensitive text makes no processing request.

### Phase 9 — V1.6 local image-to-text recognition

1. Bundle the OCR worker, compatible WebAssembly cores, and compact English model as same-origin assets.
2. Accept bounded image uploads and clipboard images, with exact crop and quarter-turn rotation controls.
3. Return editable recognized text with copy and download actions, model confidence, and accuracy limitations.
4. Prove recognition makes no processing request and remains usable after its application assets are cached.

Implementation status: implemented and verified with 282 unit tests and 50 browser-test definitions. All 98 applicable Chromium and Firefox checks passed, with the same two documented Firefox engine-specific skips described above. The browser workflow performs real local OCR, exports the recognized text, proves no processing request is issued, then repeats recognition with the network disabled using cached application assets.

### Deferred by decision — nonce-based Content Security Policy

`script-src` still carries `'unsafe-inline'`. A nonce was implemented and measured, then reverted, because it is mutually exclusive with offline support:

- Nonces require per-request rendering, so all 31 static routes became dynamic (`ƒ`) and pages were served `Cache-Control: private, no-store`.
- The service worker refuses to cache a `no-store` response by design, so the offline test for a local tool failed and offline support was lost.
- Experimental `sri` was tested as an alternative that preserves static rendering. It adds `integrity` to some external scripts but cannot cover Next's three inline flight scripts, so `'unsafe-inline'` remained necessary.

The trade is a strict `script-src` against offline availability, CDN caching, and per-request function cost. NoTrak renders no user-supplied HTML and loads no third-party scripts, so its injected-script surface is small, while offline availability is both a headline capability and the plainest demonstration of the privacy claim. Revisit if a third-party script or user-rendered content is ever introduced.

## 11. Testing checklist

### Automated

- [ ] Lint, strict typecheck, unit tests, production build, and dependency audit pass in CI.
- [ ] Pure utility functions cover valid, boundary, malformed, Unicode, and adversarial inputs.
- [ ] Crypto format has round-trip, wrong-password, corrupted-data, salt/IV uniqueness, and known-vector tests where applicable.
- [ ] API schemas reject extra-large bodies, invalid protocols/hashes, missing fields, and malformed provider responses.
- [ ] API tests mock success, not-found, timeout, quota, auth, and upstream-failure states.
- [ ] End-to-end tests cover the happy path, reset path, errors, downloads, privacy notices, keyboard use, and mobile layout for every shipped tool.

### Privacy and security

- [ ] Browser network inspection confirms local-only tools make no processing requests.
- [ ] Malware lookup sends only the SHA-256 digest; no multipart/file body exists on the route.
- [ ] URL checker contacts only the toolkit API and documented reputation providers; it never visits the submitted host.
- [ ] Password analysis makes no request; the optional HIBP lookup sends only a five-character hash prefix after confirmation and requests padded results.
- [ ] Sensitive-data redaction makes no request, masks review previews, and never presents a zero-result scan as proof of safety.
- [ ] Sensitive values do not appear in the address bar, browser storage, application logs, telemetry, or error payloads.
- [ ] Exported images/PDFs are re-opened and checked to confirm targeted metadata is removed.
- [ ] Security headers and CSP are verified in Preview and Production.
- [ ] Dependency licenses and provider attribution/terms are recorded.

### Quality

- [ ] Chrome, Firefox, Safari, and Edge current versions are tested; unsupported APIs have clear fallbacks.
- [ ] Pages work at mobile, tablet, and desktop widths without layout shift.
- [ ] Light and dark themes meet contrast targets, follow the initial system preference, persist an explicit override, return to following the system, and avoid an incorrect-theme flash.
- [ ] The `/tools` index reaches every released tool, filters by category, searches by name and description, and reports result counts to assistive technology.
- [ ] `sitemap.xml` lists every released tool page, `robots.txt` disallows `/api/`, and each tool page carries its own canonical URL.
- [ ] Unknown routes render the NoTrak 404 page, and a thrown tool error renders the boundary without exposing a filename, URL, or hash.
- [ ] A blocked clipboard write shows the manual-copy fallback instead of failing silently.
- [ ] A local tool still runs with the network disabled, and no `/api` response appears in Cache Storage.
- [ ] An encrypted container does not contain the original filename in readable form.
- [ ] The exposure score changes when a browser capability is disabled, and can reach every band.
- [ ] Each provider failure cause is distinguishable in the UI and none of them reads as `safe`.
- [ ] Forms have labels, focus states, keyboard operation, screen-reader status announcements, and sufficient contrast.
- [ ] Motion respects `prefers-reduced-motion`, and essential workflows remain usable at 200% zoom.
- [ ] Large-file limits, memory failures, provider outages, and offline behavior produce useful non-destructive messages.
- [ ] Lighthouse/accessibility/performance checks meet agreed thresholds on representative pages.

## 12. MVP milestones and completion criteria

| Milestone | Deliverable | Done when |
|---|---|---|
| M0 — Foundation | Scaffold, design system, registry, CI, privacy page | Preview build passes checks and shared tool-page conventions are documented |
| M1 — First usable slice | Shell + IP + password + URL cleaner | All three work on mobile/desktop with tests and accurate privacy labels |
| M2 — Local toolkit | Hash, passphrase, UUID, QR, EXIF, compression | Network audit proves processing stays local; downloads are verified |
| M3 — V1 | Encryption, privacy check, speed test, PDF cleaner | Thirteen V1 tools pass functional, privacy, accessibility, and production checks |
| M4 — V1.1 intelligence | URL and hash reputation tools plus remaining utilities | Provider terms/quotas are approved; failure/abuse controls and disclosures are live |
| M5 — V1.2 quality | Theme support, tool discovery and SEO surfaces, failure boundaries, resilient provider states, Speed Test confidence, corrected privacy claims, offline support, and four new local tools | All 22 tools pass light/dark, keyboard, responsive, privacy-boundary, and protected Preview checks before production promotion |
| M6 — V1.3 local safety and file utilities | Local password analysis, optional k-anonymous HIBP range lookup, image resizing, and PDF organization | Password analysis, image resizing, and PDF organization make no processing request; the confirmed HIBP lookup exposes only the documented prefix and IP; all 25 tools pass the release gate |
| M7 — V1.4 local email header analysis | Local header unfolding, delivery-chain reconstruction, reported-authentication parsing, and explained sender mismatch signals | Header analysis issues no request of any kind, never presents a reported verdict as verification or a clean report as proof of legitimacy, and all 26 tools pass the release gate |
| M8 — V1.5 local sensitive-data redaction | Conservative local detection, per-finding review, consistent placeholders, and sanitized copy/download | Redaction issues no request, payment-card findings pass Luhn validation, a clean scan carries an explicit limitation, and all 27 tools pass the release gate |
| M9 — V1.6 local image-to-text recognition | Local OCR engine and English model, upload/paste input, crop, rotation, editable result, and text download | Recognition issues no processing request, the result carries an accuracy limitation, cached OCR assets work offline, and all 28 tools pass the release gate |

## 13. Deployment notes

1. Connect the GitHub repository to Vercel and use automatic Preview deployments for pull requests.
2. Pin the Node/package-manager version and commit the lockfile.
3. Add secrets only through Vercel project settings; keep `.env*` ignored except `.env.example`.
4. Run lint, typecheck, unit/integration tests, and `next build` before merging.
5. Validate function runtime compatibility, region behavior, headers, timeouts, and provider access in Preview.
6. Add a custom domain only when desired; Vercel's generated domain is sufficient for the MVP.
7. Monitor Vercel usage and external API quotas without recording user inputs. Disable an external lookup gracefully if a quota is exhausted.
8. Re-check Hobby-plan eligibility before monetization or material traffic growth, and plan an upgrade/migration instead of relying on free-tier assumptions indefinitely.

## 14. First Codex implementation task

Scaffold the repository, create the shared design system and tool registry, then implement **What's My IP**, **Password Generator**, and **Tracking URL Cleaner** with tests, privacy notices, and a Vercel Preview deployment. Do not begin the external reputation integrations until the V1 local-tool pattern is stable.
