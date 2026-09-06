# External provider notices

Reviewed on 2026-09-06. Credentialed provider integrations are disabled until the corresponding server-only credential is configured. The credential-free Have I Been Pwned range lookup and Cloudflare DNS lookup run only after a visitor explicitly confirms their disclosure. Operators must review these terms again before launch, monetization, or a material traffic increase.

| Provider | Data transmitted | Activation | Usage boundary |
| --- | --- | --- | --- |
| Google Safe Browsing v5 | Full confirmed URL | `GOOGLE_SAFE_BROWSING_API_KEY` | Safe Browsing is documented for non-commercial use; commercial deployments must use an eligible alternative such as Web Risk. <https://developers.google.com/safe-browsing> |
| URLhaus Community API | Full confirmed URL | `URLHAUS_AUTH_KEY` | Auth-Key required. Community access is subject to abuse.ch fair-use principles; commercial use may require the enhanced API. <https://urlhaus.abuse.ch/api/> |
| MalwareBazaar Community API | SHA-256 digest only | `MALWAREBAZAAR_API_KEY` | Auth-Key required. Community access is subject to abuse.ch fair-use principles; commercial use may require the enhanced API. <https://bazaar.abuse.ch/api/> |
| Have I Been Pwned Pwned Passwords | First five hexadecimal characters of a SHA-1 password hash; the provider also receives the request IP | No credential; explicit visitor confirmation | Browser-direct k-anonymous range lookup with response padding requested. No password or full hash is transmitted. <https://haveibeenpwned.com/API/v3#PwnedPasswords> |
| Cloudflare Public DNS | Normalized domain and selected DNS record type; the provider also receives the request IP | No credential; explicit visitor confirmation | Browser-direct DNS-over-HTTPS JSON lookup. The website is not visited and URL paths are removed locally. <https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/dns-json/> |

NoTrak does not submit indicators, download samples, open URLs, or expose provider keys to the browser. Credentialed reputation responses are normalized and returned with `Cache-Control: private, no-store`. The HIBP and Cloudflare DNS lookups go directly from the visitor's browser to fixed provider endpoints; their responses are processed locally and are not stored by NoTrak.

The application includes strict JSON schemas, 4 KB request bodies, six-second provider timeouts, fixed provider destinations, and a best-effort per-instance request ceiling. Before public activation, configure platform-level rate limiting and quota alerts because serverless instances cannot provide a reliable global in-memory limit.
