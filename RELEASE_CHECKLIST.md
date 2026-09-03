# V1.2 release checklist

This runbook separates repository checks from actions that require access to Vercel and the reputation-provider accounts. Never paste credentials into issues, pull requests, logs, or committed files.

## 1. Repository gate

Run from a clean checkout using the pinned Node and pnpm versions:

```bash
pnpm install --frozen-lockfile
pnpm release:check
```

`release:check` runs lint, strict TypeScript, unit tests, a production build, the production dependency audit, and Playwright release smoke tests in Chromium, Firefox, and WebKit.

## 2. Provider approval and credentials

1. Confirm the deployment remains personal and non-commercial before enabling Google Safe Browsing. A commercial deployment needs an eligible service such as Google Web Risk.
2. Review URLhaus and MalwareBazaar Community API fair-use, attribution, and commercial-use requirements.
3. Create separate credentials where the provider supports environment separation.
4. Add `GOOGLE_SAFE_BROWSING_API_KEY`, `URLHAUS_AUTH_KEY`, and `MALWAREBAZAAR_API_KEY` to Vercel Preview only. Do not use a `NEXT_PUBLIC_` prefix for secrets.
5. Set the non-secret `NEXT_PUBLIC_SITE_URL` to the canonical production origin, such as `https://notrak.vercel.app`, so Preview builds emit production canonical, Open Graph, sitemap, and robots URLs.
6. Verify the provider credentials without printing values:

```bash
vercel env run --environment=preview -- pnpm release:providers
```

Provider notices and source links are maintained in `PROVIDER_NOTICES.md`.

## 3. Preview deployment

1. Link the repository to the intended Vercel project and confirm `main` is the Production Branch.
2. Enable Vercel Authentication for Preview deployments before testing real provider credentials.
3. Deploy a non-production branch or run `vercel deploy --logs`.
4. Verify the deployment root, all tool pages, and both security routes.
5. Confirm reputation responses use `Cache-Control: private, no-store, max-age=0` and never contain credentials or raw upstream errors.
6. Confirm the malware route accepts JSON containing one SHA-256 digest and rejects form or file bodies.
7. Run an operator-approved provider test vector. Do not put a suspicious live URL into source code, CI output, or this runbook.
8. Inspect deployment logs for errors and confirm no application log contains submitted URLs, hashes, or request bodies.

## 4. Abuse and quota controls

1. In Vercel Firewall, create a custom rule for POST requests to `/api/security/url` and `/api/security/file-hash`.
2. Begin with a log action and observe Preview traffic.
3. Change the rule to rate limit by client IP, initially 30 requests per 60 seconds with a 429 response. Tune only from aggregate traffic and provider-quota data, never from stored user inputs.
4. Enable Vercel usage/spend notifications and the available quota alerts for all three providers.
5. Confirm quotas, rate limits, timeouts, credential failures, malformed responses, and provider outages produce their distinct incomplete states without disabling local analysis or being presented as a clean result.

The in-process 120-request ceiling is defense in depth only; serverless instances cannot enforce a global quota.

## 5. Manual release QA

- Test current Chrome, Firefox, Safari, and Edge on desktop.
- Test responsive layouts and keyboard navigation at mobile, tablet, and desktop widths.
- Test QR camera permission on a physical iOS and Android device. Confirm permission is requested only after **Start camera** and the stream stops on reset/navigation.
- Re-open converted images and cleaned PDFs and verify the expected output and metadata behavior.
- Install the app once, open representative local tools, disable the network, and verify cached local workflows still run while `/api` responses remain absent from Cache Storage.
- Inspect a real photo in EXIF Viewer, verify its named fields and any location warning, then confirm EXIF Remover produces a clean downloadable copy.
- Run Lighthouse accessibility and performance checks in an incognito profile and record the results outside the repository if they contain deployment details.
- Reconfirm Privacy, Methodology, provider notices, and the exact data-transfer disclosure in each reputation tool.

## 6. Production promotion and rollback

1. Add the approved provider credentials to Production and redeploy; environment-variable changes do not affect previous deployments.
2. Review the Preview deployment, CI result, browser matrix, provider quotas, firewall rule, and notices with the release owner.
3. Promote the verified deployment or run `vercel deploy --prod`.
4. Check the production root, headers, reputation routes, and error logs immediately after promotion.
5. If checks fail, roll back to the last known-good Vercel deployment and disable or remove provider credentials if the incident involves external lookups.

Production promotion is intentionally a human approval gate.
