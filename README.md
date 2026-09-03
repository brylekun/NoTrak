# NoTrak

Private browser tools with no accounts, file uploads, or saved history.

NoTrak currently includes 18 V1/V1.1 tools for connection and reputation checks, secure generation, hashing, image and QR processing, file encryption, browser privacy education, token inspection, and PDF metadata cleanup.

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

The speed test intentionally sends bulk measurement traffic to Cloudflare after explicit activation. Reputation checks transmit either the confirmed full URL or a locally calculated SHA-256 hash through NoTrak to configured providers. Provider integrations remain inactive until server-only credentials are configured. See the in-app Privacy and Methodology pages for exact limitations and data boundaries.
