"use client";

import { useEffect } from "react";

/**
 * Registers the offline service worker. Kept in its own client component so the
 * rest of the layout stays a server component, and deliberately silent: failing
 * to register only costs offline support, so there is nothing to tell the user.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      // A production worker left behind by `next start` can otherwise serve
      // stale chunk URLs during `next dev`. Remove only NoTrak's own worker and
      // caches; do not touch unrelated registrations on the same browser.
      void navigator.serviceWorker.getRegistrations().then((registrations) =>
        Promise.all(
          registrations
            .filter((registration) => {
              const scriptUrl = registration.active?.scriptURL
                ?? registration.waiting?.scriptURL
                ?? registration.installing?.scriptURL;
              return scriptUrl ? new URL(scriptUrl).pathname === "/sw.js" : false;
            })
            .map((registration) => registration.unregister()),
        ),
      ).catch(() => undefined);
      if ("caches" in window) {
        void caches.keys().then((keys) =>
          Promise.all(keys.filter((key) => key.startsWith("notrak-")).map((key) => caches.delete(key))),
        ).catch(() => undefined);
      }
      return;
    }

    // Registration competes with first paint, so it waits for load.
    const register = () => {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
