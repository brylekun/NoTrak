# NoTrak

Private browser tools with no accounts, file uploads, or saved history.

NoTrak currently includes 22 tools for connection and reputation checks, secure generation, hashing, image and QR processing, file and text encryption, browser privacy education, metadata inspection and removal, and developer utilities. Browse them all at `/tools`, which filters by category and searches by name.

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

## Privacy boundary

Local tools must not send their inputs to NoTrak or third parties. External lookup tools must show exactly what leaves the device. Never add accounts, a database, cloud file storage, or sensitive browser persistence without revisiting the product architecture.

Set `NEXT_PUBLIC_SITE_URL` in Vercel so canonical URLs, Open Graph tags, `sitemap.xml`, and `robots.txt` use the real domain. It holds no secret; without it the app falls back to the Vercel-provided domain and then `localhost`.

The speed test intentionally sends bulk measurement traffic to Cloudflare after explicit activation. Reputation checks transmit either the confirmed full URL or a locally calculated SHA-256 hash through NoTrak to configured providers. Provider integrations remain inactive until server-only credentials are configured. See the in-app Privacy and Methodology pages for exact limitations and data boundaries.
