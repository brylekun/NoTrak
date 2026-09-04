/*
 * NoTrak service worker.
 *
 * Purpose: let the local-only tools keep working with the network off, which is
 * the most direct demonstration of the privacy claim -- if a tool runs offline,
 * it cannot be sending your input anywhere.
 *
 * Privacy rules this file must keep:
 *   1. Never cache /api/* -- those responses are personalized and no-store.
 *   2. Never cache a cross-origin request (Cloudflare speed-test traffic).
 *   3. Never cache a response that asks not to be stored.
 *   4. Only ever cache same-origin GET requests.
 * Nothing a visitor types, selects, or generates passes through here: only the
 * application's own pages and static assets are stored.
 */

const CACHE_VERSION = "notrak-v2";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const ASSET_CACHE = `${CACHE_VERSION}-assets`;
const PAGE_CACHE = `${CACHE_VERSION}-pages`;
const OFFLINE_URL = "/offline";

const SHELL_URLS = ["/", "/tools", "/offline", "/privacy", "/methodology", "/support"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // A missing entry must not abort the install, so each URL is added
      // independently.
      await Promise.allSettled(SHELL_URLS.map((url) => cache.add(new Request(url, { cache: "reload" }))));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => !key.startsWith(CACHE_VERSION)).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "notrak-skip-waiting") self.skipWaiting();
});

function isCacheableResponse(response) {
  if (!response || !response.ok || response.type === "opaque") return false;
  const control = response.headers.get("Cache-Control") || "";
  return !/no-store/i.test(control);
}

async function cachePut(cacheName, request, response) {
  if (!isCacheableResponse(response)) return;
  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
}

/** Hashed build assets never change under the same URL. */
async function cacheFirst(request) {
  const cached = await caches.match(request, { cacheName: ASSET_CACHE });
  if (cached) return cached;

  const response = await fetch(request);
  await cachePut(ASSET_CACHE, request, response);
  return response;
}

/** Pages come from the network when possible so content is never stale. */
async function networkFirstPage(request) {
  try {
    const response = await fetch(request);
    await cachePut(PAGE_CACHE, request, response);
    return response;
  } catch (reason) {
    const cached =
      (await caches.match(request, { cacheName: PAGE_CACHE })) ||
      (await caches.match(request, { cacheName: SHELL_CACHE }));
    if (cached) return cached;

    const offline =
      (await caches.match(OFFLINE_URL, { cacheName: SHELL_CACHE })) ||
      (await caches.match(OFFLINE_URL));
    if (offline) return offline;

    throw reason;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Rule 2: leave every cross-origin request to the network untouched.
  if (url.origin !== self.location.origin) return;
  // Rule 1: reputation and IP lookups are never stored or replayed.
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Everything else same-origin: serve from cache while refreshing in place.
  event.respondWith(
    (async () => {
      const cached = await caches.match(request, { cacheName: ASSET_CACHE });
      const network = fetch(request)
        .then(async (response) => {
          await cachePut(ASSET_CACHE, request, response);
          return response;
        })
        .catch(() => undefined);

      const response = cached || (await network);
      if (response) return response;
      return Response.error();
    })(),
  );
});
