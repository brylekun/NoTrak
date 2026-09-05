# NoTrak

[![GitHub Sponsors](https://img.shields.io/github/sponsors/brylekun?label=Sponsor&logo=githubsponsors&logoColor=EA4AAA&color=EA4AAA)](https://github.com/sponsors/brylekun)
[![PayPal](https://img.shields.io/badge/PayPal-Donate-00457C?logo=paypal&logoColor=white)](https://www.paypal.com/donate/?business=brylekun%40gmail.com&item_name=NoTrak%20development&currency_code=USD)
[![Monero](https://img.shields.io/badge/Monero-XMR-FF6600?logo=monero&logoColor=white)](#support)

Private browser tools with no accounts, file uploads, or saved history.

NoTrak currently includes 30 tools for connection and reputation checks, password safety, sensitive-data redaction, local image-to-text OCR, private resume building and video preparation, email header analysis, secure generation, hashing, image, QR, and PDF processing, file and text encryption, browser privacy education, metadata inspection and removal, and developer utilities. Browse them all at `/tools`, which filters by category and searches by name.

The Private Resume Builder offers Classic and Compact single-column layouts, A4/Letter pages, a paginated live preview, selectable-text PDF export, and local JSON draft downloads/imports. Content is never autosaved or uploaded. Bundled OFL-licensed Noto Sans fonts support Latin, Greek, and Cyrillic; unsupported characters are rejected rather than silently dropped. Resumes are limited to eight pages, twelve entries per section, and 40,000 serialized draft characters. Draft files are unencrypted.

The Private Video Toolkit accepts a browser-readable MP4 or WebM owned by the visitor and creates a new MP4 locally. It supports trimming, 720p/1080p output, original/16:9/1:1/4:5/9:16 framing, three quality levels, audio removal or volume adjustment, and JPEG thumbnail capture. Inputs are limited to 75 MB, 3 minutes, and 4K because WebAssembly video encoding is memory- and CPU-intensive. The roughly 31 MB single-thread engine is loaded from NoTrak's own origin only when processing starts and is excluded from the service worker's offline cache.

The local tools keep working offline: NoTrak installs a service worker that caches only its own pages and assets. Running a tool with the network off demonstrates that its core processing does not depend on a server; the source code and network tests enforce the stronger no-input-transmission guarantee.

## Stack

- Next.js App Router and TypeScript
- Tailwind CSS and shadcn/ui
- Browser-first processing with Web Platform APIs
- Vercel Hobby deployment target

## Local development

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Before a V1.1 Preview or Production promotion, run the complete browser and dependency gate:

```bash
pnpm exec playwright install --with-deps chromium firefox webkit
pnpm release:check
```

The operational sequence and human approval gates are in [`RELEASE_CHECKLIST.md`](./RELEASE_CHECKLIST.md).

The detailed build sequence, privacy boundaries, and roadmap are in [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md).

## Support

NoTrak carries no advertising, analytics, or affiliate links, so it earns nothing. Contributions cover the domain and hosting, and buy no influence over what the app sends over the network.

- [GitHub Sponsors](https://github.com/sponsors/brylekun) — recurring or one-time
- [PayPal](https://www.paypal.com/donate/?business=brylekun%40gmail.com&item_name=NoTrak%20development&currency_code=USD) — one-time
- Monero — the address, a copy button, and a locally generated QR code are on the in-app `/support` page

The site footer uses plain text donation links. A floating Buy Me a Coffee widget for `NoTrak` also appears at the bottom right. It loads the provider's script, icon, and font on page load, exposing the visitor's IP address to that provider; its donation iframe loads when opened. This exception is disclosed on `/privacy` and `/support`. The CSP permits only the widget's script URL, asset host, and frame host in the relevant directives.

Funding targets live in [`lib/support.ts`](./lib/support.ts). The Monero address is intentionally empty there until a verified address is pasted in; while it is empty, the app renders no Monero section rather than a placeholder that could be mistaken for a real address.

## Privacy boundary

Local tools must not send their inputs to NoTrak or third parties. External lookup tools must show exactly what leaves the device. Never add accounts, a database, cloud file storage, or sensitive browser persistence without revisiting the product architecture.

Set `NEXT_PUBLIC_SITE_URL` in Vercel so canonical URLs, Open Graph tags, `sitemap.xml`, and `robots.txt` use the real domain. It holds no secret; without it the app falls back to the Vercel-provided domain and then `localhost`.

The speed test intentionally sends bulk measurement traffic to Cloudflare after explicit activation. Reputation checks transmit either the confirmed full URL or a locally calculated SHA-256 hash through NoTrak to configured providers. The Password Safety Checker analyzes the password locally; after a separate confirmation, its optional breach check sends only the first five characters of a SHA-1 lookup identifier directly to Have I Been Pwned. The password and full hash never leave the browser. See the in-app Privacy and Methodology pages for exact limitations and data boundaries.
