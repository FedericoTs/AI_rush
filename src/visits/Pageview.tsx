"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Counts a visit, once, after the page is real.
 *
 * Deliberately client-side. A server-side count includes every crawler,
 * link-preview fetch and prefetch, and a launch is exactly when those spike —
 * so a row here means a browser executed JavaScript. That undercounts anyone
 * with scripts off, and undercounting honestly beats counting an unfurler as
 * a visitor.
 *
 * `sendBeacon` rather than `fetch` for the same reason the run beacon uses it:
 * a request from a page that is about to be navigated away from is cancelled,
 * and someone who bounces immediately is precisely the person worth counting.
 */
export function Pageview() {
  const path = usePathname();
  /*
   * Module-scope would be wrong and a ref is right: this has to survive route
   * changes within one page load, and reset on a real one. That makes it
   * "first view in this document", which is *not* the same as an arrival — a
   * redirect between our own pages resets it too. `isArrival` settles it.
   */
  const sent = useRef<string | null>(null);
  const arrived = useRef(false);

  useEffect(() => {
    if (!path || sent.current === path) return;
    sent.current = path;

    const first = !arrived.current;
    arrived.current = true;

    /*
     * The referrer goes every time, and whether this counts as an arrival is
     * decided on the server — because it takes both this flag and the
     * referrer's host to tell the difference, and only one place should know
     * the rule. See `isArrival`.
     */
    const body = JSON.stringify({ path, ref: document.referrer, first });
    try {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon?.("/api/view", blob)) return;
      void fetch("/api/view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* A blocked Blob, a disabled sendBeacon, an extension in the way. A
         missing count is never worth a broken page. */
    }
  }, [path]);

  return null;
}
