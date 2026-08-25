import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRunBeacon, type RunBeaconInput } from "./useRunBeacon";
import type { RunEvent } from "@/engine/scoring";

/** What the browser was handed, decoded back into the payload we sent. */
let sent: Array<{ runId: string; events: RunEvent[]; elapsedMs: number }>;

function hide() {
  Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

function show() {
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

function ev(seq: number, kind: RunEvent["kind"], levelId: string, atMs: number): RunEvent {
  return { seq, kind, levelId, atMs };
}

function base(over: Partial<RunBeaconInput> = {}): RunBeaconInput {
  return {
    runId: "run-1", runSecret: "secret-1", arena: false,
    events: [], elapsedMs: 0, live: true,
    ...over,
  };
}

beforeEach(() => {
  sent = [];
  /* jsdom has no sendBeacon. Standing in for it also proves we call it rather
     than falling through to the fetch path, which a closing tab cancels. */
  vi.stubGlobal("navigator", Object.assign(Object.create(Object.getPrototypeOf(navigator)), navigator, {
    sendBeacon: (_url: string, blob: Blob) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sent.push(JSON.parse((blob as any).__text ?? "{}"));
      return true;
    },
  }));
  /* jsdom's Blob cannot be read synchronously, and the hook is fire-and-
     forget — so keep the text on the instance for the stub above. */
  const RealBlob = globalThis.Blob;
  vi.stubGlobal("Blob", class extends RealBlob {
    __text: string;
    constructor(parts: BlobPart[], opts?: BlobPropertyBag) {
      super(parts, opts);
      this.__text = String(parts[0] ?? "");
    }
  });
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("{}"))));
  show();
});

afterEach(() => {
  vi.unstubAllGlobals();
  show();
});

describe("when it fires", () => {
  it("sends what has happened so far when the page hides", () => {
    const events = [ev(1, "enter", "L10", 400), ev(2, "skip", "L10", 9000)];
    renderHook(() => useRunBeacon(base({ events, elapsedMs: 9200 })));

    hide();

    expect(sent).toHaveLength(1);
    expect(sent[0]!.runId).toBe("run-1");
    expect(sent[0]!.elapsedMs).toBe(9200);
    /* The whole point: which level was on screen when they left. */
    expect(sent[0]!.events.at(-1)!.levelId).toBe("L10");
  });

  it("fires on pagehide too, for the browsers that only send that one", () => {
    renderHook(() => useRunBeacon(base()));
    window.dispatchEvent(new Event("pagehide"));
    expect(sent).toHaveLength(1);
  });

  it("sends a run with no events at all", () => {
    /* "Started and left after four seconds" is a finding. A run that never
       beacons at all is a different one, and they must stay distinguishable. */
    renderHook(() => useRunBeacon(base({ elapsedMs: 4000 })));
    hide();
    expect(sent).toHaveLength(1);
    expect(sent[0]!.events).toEqual([]);
  });
});

describe("when it stays quiet", () => {
  it("never fires for a practice run, which has no run to file", () => {
    renderHook(() => useRunBeacon(base({ runId: null, runSecret: null })));
    hide();
    expect(sent).toEqual([]);
  });

  it("never fires for an arena run", () => {
    /* Agent runs are filed in their own tables. A beacon here would write a
       human row for a machine, which is the one thing the split exists to
       make impossible. */
    renderHook(() => useRunBeacon(base({ arena: true })));
    hide();
    expect(sent).toEqual([]);
  });

  it("stops once the run reaches the tally", () => {
    /* From there `finish` owns the run, and a beacon racing it would append
       events under sequence numbers the submit is about to reuse. */
    renderHook(() => useRunBeacon(base({ live: false })));
    hide();
    expect(sent).toEqual([]);
  });

  it("does not repeat itself when nothing has changed", () => {
    const events = [ev(1, "enter", "L01", 100)];
    const { rerender } = renderHook((p: RunBeaconInput) => useRunBeacon(p), {
      initialProps: base({ events, elapsedMs: 1000 }),
    });

    hide();
    show();
    rerender(base({ events, elapsedMs: 3000 }));
    hide();

    expect(sent).toHaveLength(1);
  });
});

describe("what it re-sends", () => {
  it("sends again once something new has happened", () => {
    const first = [ev(1, "enter", "L01", 100)];
    const { rerender } = renderHook((p: RunBeaconInput) => useRunBeacon(p), {
      initialProps: base({ events: first, elapsedMs: 1000 }),
    });

    hide();
    show();
    rerender(base({ events: [...first, ev(2, "solve", "L01", 5000)], elapsedMs: 5200 }));
    hide();

    expect(sent).toHaveLength(2);
    expect(sent[1]!.events).toHaveLength(2);
  });

  it("sends again after a long stretch with no events, to date the exit", () => {
    /* The L10 case. They entered it, stared at it for ninety seconds and gave
       up. Without this the record says when they arrived, not how long they
       endured — and the difference is the entire finding. */
    const events = [ev(1, "enter", "L10", 20_000)];
    const { rerender } = renderHook((p: RunBeaconInput) => useRunBeacon(p), {
      initialProps: base({ events, elapsedMs: 20_000 }),
    });

    hide();
    show();
    rerender(base({ events, elapsedMs: 110_000 }));
    hide();

    expect(sent).toHaveLength(2);
    expect(sent[1]!.elapsedMs).toBe(110_000);
  });
});
