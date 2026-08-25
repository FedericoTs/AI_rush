import { useEffect, useRef } from "react";
import type { RunEvent } from "@/engine/scoring";

/** A beacon with nothing new to say still tells us they were still here. */
const RESEND_AFTER_MS = 30_000;

export interface RunBeaconInput {
  runId: string | null;
  runSecret: string | null;
  /** Arena runs live in their own tables and are not part of this funnel. */
  arena: boolean;
  events: readonly RunEvent[];
  /** Run-clock milliseconds so far. */
  elapsedMs: number;
  /** False once the run reaches the tally — `finish` owns it from there. */
  live: boolean;
}

/**
 * Tell the server how far this run got, at the last moment a browser gives us.
 *
 * Without this, a run that is never submitted has no events at all — see
 * `0006_run_beacon.sql`. On the first day of real traffic that was 28 of 38
 * runs, every one of them a player whose reason for leaving is unrecorded and
 * unrecordable.
 *
 * ── Why two events ──────────────────────────────────────────────────────
 *
 * `visibilitychange` is the one modern browsers actually promise to deliver
 * before a tab goes away, and `unload` is the one they have been quietly
 * dropping for years — on mobile especially, where the page is frozen rather
 * than unloaded when you switch apps. `pagehide` is kept alongside it because
 * Safari's bfcache path has historically fired that and not the other.
 *
 * Both are wired to the same idempotent send, so a browser that fires both
 * costs one extra conflicting insert.
 *
 * ── Why `sendBeacon` ────────────────────────────────────────────────────
 *
 * A plain `fetch` from a hidden or closing page is cancelled, which is the
 * failure this whole feature exists to avoid — telemetry that works on your
 * machine while you watch it and silently never fires for anybody else.
 * `sendBeacon` hands the request to the browser to deliver after the page is
 * gone. `keepalive` is the fallback for the same reason, and a bare `fetch`
 * is deliberately not one.
 */
export function useRunBeacon(input: RunBeaconInput): void {
  /* Read through a ref: these handlers are registered once and must see the
     run as it is when the page hides, not as it was on the render that
     installed them. Written in an effect rather than during render, which is
     both the rule and the truth — a ref is not part of the render output. */
  const latest = useRef(input);
  useEffect(() => {
    latest.current = input;
  });

  useEffect(() => {
    /* The highest sequence already sent, and when. Both live for the lifetime
       of the run, so a player who switches tabs twenty times sends what
       changed rather than the same log twenty times. */
    let sentSeq = -1;
    let sentAt = -1;

    const send = () => {
      const { runId, runSecret, arena, events, elapsedMs, live } = latest.current;
      if (!runId || !runSecret || arena || !live) return;

      const lastSeq = events.length > 0 ? events[events.length - 1]!.seq : 0;
      const nothingNew = lastSeq === sentSeq && elapsedMs - sentAt < RESEND_AFTER_MS;
      if (sentSeq >= 0 && nothingNew) return;
      sentSeq = lastSeq;
      sentAt = elapsedMs;

      const body = JSON.stringify({ runId, runSecret, events, elapsedMs });
      try {
        const blob = new Blob([body], { type: "application/json" });
        if (navigator.sendBeacon?.("/api/run/beacon", blob)) return;
        void fetch("/api/run/beacon", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => {});
      } catch {
        /* A blocked Blob, a disabled sendBeacon, an extension in the way.
           Nothing here is worth interrupting a run for. */
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") send();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", send);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", send);
    };
  }, []);
}
