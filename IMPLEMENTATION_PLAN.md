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
- Do not include temporary email, file sharing, proxy/VPN features, AI analysis, or breach lookup in this project.
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
  privacy/page.tsx
  tools/
    [slug]/page.tsx                 # optional registry-driven shared route
    whats-my-ip/page.tsx
    speed-test/page.tsx
    tracking-url-cleaner/page.tsx
    remove-exif/page.tsx
    image-compressor/page.tsx
    password-generator/page.tsx
    passphrase-generator/page.tsx
    file-encryption/page.tsx
    hash-generator/page.tsx
    qr-generator/page.tsx
    browser-privacy/page.tsx
    pdf-metadata-cleaner/page.tsx
    phishing-checker/page.tsx
    malware-reputation/page.tsx
  api/
    ip/route.ts
    security/
      url/route.ts
      file-hash/route.ts
components/
  layout/
  tool-shell.tsx
  tool-card.tsx
  privacy-notice.tsx
  result-state.tsx
  ui/                              # shadcn/ui components
lib/
  tools/registry.ts
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

`lib/tools/registry.ts` is the single source of truth for each tool's slug, name, description, category, processing mode (`local` or `external-lookup`), status, and privacy notice. Use it to populate navigation, homepage cards, and metadata.

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

Possible later local-only additions: EXIF viewer, image resizer, Base64 encoder/decoder, JSON formatter, text encryption, user-agent analyzer, username generator, and synthetic test identity generator.

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
```

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
- [ ] Sensitive values do not appear in the address bar, browser storage, application logs, telemetry, or error payloads.
- [ ] Exported images/PDFs are re-opened and checked to confirm targeted metadata is removed.
- [ ] Security headers and CSP are verified in Preview and Production.
- [ ] Dependency licenses and provider attribution/terms are recorded.

### Quality

- [ ] Chrome, Firefox, Safari, and Edge current versions are tested; unsupported APIs have clear fallbacks.
- [ ] Pages work at mobile, tablet, and desktop widths without layout shift.
- [ ] Forms have labels, focus states, keyboard operation, screen-reader status announcements, and sufficient contrast.
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
