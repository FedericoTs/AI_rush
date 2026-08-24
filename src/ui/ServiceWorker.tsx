"use client";

import { useEffect } from "react";

/**
 * Registering the worker, and the one guardrail that matters.
 *
 * A service worker outlives the page that installed it. If this app ever needs
 * to stop being a PWA — or if a released worker turns out to be broken — the
 * only way to undo it is a *new* worker that unregisters itself, because the
 * old one is already on thousands of devices answering requests. Removing
 * `public/sw.js` would not help: the installed copy keeps running.
 *
 * So the escape hatch is here, in the page, where it can be changed and
 * deployed in one commit: flip `ENABLED` to false and the next visit
 * unregisters the worker and drops every cache it made.
 */
const ENABLED = true;

export function ServiceWorker() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    if (!ENABLED) {
      void navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const reg of regs) void reg.unregister();
      });
      if (typeof caches !== "undefined") {
        void caches.keys().then((keys) => {
          for (const k of keys) if (k.startsWith("ai-rush-")) void caches.delete(k);
        });
      }
      return;
    }

    /* Deliberately not awaited and deliberately silent. A failed registration
       — an unsupported browser, a private window, a locked-down enterprise
       policy — must cost the player nothing: the game works without it. */
    void navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  return null;
}
