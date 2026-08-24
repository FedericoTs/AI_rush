import type { Adapter, KeySample } from "./types";

export function createKeyboardAdapter(target: HTMLElement | Window = window): Adapter<KeySample> {
  const subs = new Set<(v: KeySample) => void>();
  const held = new Set<string>();
  let last: KeySample = { key: "", code: "", phase: "up" };

  const emit = (e: KeyboardEvent, phase: KeySample["phase"]) => {
    if (phase === "down") {
      if (held.has(e.code)) return; // ignore OS auto-repeat; levels want edges
      held.add(e.code);
    } else {
      held.delete(e.code);
    }
    last = { key: e.key, code: e.code, phase };
    for (const cb of subs) cb(last);
  };

  const onDown = (e: Event) => emit(e as KeyboardEvent, "down");
  const onUp = (e: Event) => emit(e as KeyboardEvent, "up");
  target.addEventListener("keydown", onDown);
  target.addEventListener("keyup", onUp);

  return {
    subscribe: (cb) => (subs.add(cb), () => subs.delete(cb)),
    current: () => last,
    destroy() {
      target.removeEventListener("keydown", onDown);
      target.removeEventListener("keyup", onUp);
      subs.clear();
      held.clear();
    },
  };
}
