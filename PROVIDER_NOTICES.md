# Reputation provider notices

Reviewed on 2026-09-03. Provider integrations are disabled until the corresponding server-only credential is configured. Operators must review these terms again before launch, monetization, or a material traffic increase.

| Provider | Data transmitted | Activation | Usage boundary |
| --- | --- | --- | --- |
| Google Safe Browsing v5 | Full confirmed URL | `GOOGLE_SAFE_BROWSING_API_KEY` | Safe Browsing is documented for non-commercial use; commercial deployments must use an eligible alternative such as Web Risk. <https://developers.google.com/safe-browsing> |
| URLhaus Community API | Full confirmed URL | `URLHAUS_AUTH_KEY` | Auth-Key required. Community access is subject to abuse.ch fair-use principles; commercial use may require the enhanced API. <https://urlhaus.abuse.ch/api/> |
| MalwareBazaar Community API | SHA-256 digest only | `MALWAREBAZAAR_API_KEY` | Auth-Key required. Community access is subject to abuse.ch fair-use principles; commercial use may require the enhanced API. <https://bazaar.abuse.ch/api/> |

NoTrak does not submit indicators, download samples, open URLs, or expose provider keys to the browser. Provider responses are normalized and returned with `Cache-Control: private, no-store`.

The application includes strict JSON schemas, 4 KB request bodies, six-second provider timeouts, fixed provider destinations, and a best-effort per-instance request ceiling. Before public activation, configure platform-level rate limiting and quota alerts because serverless instances cannot provide a reliable global in-memory limit.
