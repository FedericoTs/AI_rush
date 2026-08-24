import type { Adapter, PointerSample } from "./types";

/** Mouse, touch and pen, normalised to one stream with a live contact count. */
export function createPointerAdapter(target: HTMLElement | Window = window): Adapter<PointerSample> {
  const subs = new Set<(v: PointerSample) => void>();
  const active = new Set<number>();
  let last: PointerSample = { x: 0, y: 0, id: -1, phase: "up", count: 0 };

  const emit = (e: PointerEvent, phase: PointerSample["phase"]) => {
    if (phase === "down") active.add(e.pointerId);
    if (phase === "up") active.delete(e.pointerId);
    last = { x: e.clientX, y: e.clientY, id: e.pointerId, phase, count: active.size };
    for (const cb of subs) cb(last);
  };

  const onDown = (e: Event) => emit(e as PointerEvent, "down");
  const onMove = (e: Event) => emit(e as PointerEvent, "move");
  const onUp = (e: Event) => emit(e as PointerEvent, "up");

  target.addEventListener("pointerdown", onDown);
  target.addEventListener("pointermove", onMove);
  target.addEventListener("pointerup", onUp);
  target.addEventListener("pointercancel", onUp);

  return {
    subscribe: (cb) => (subs.add(cb), () => subs.delete(cb)),
    current: () => last,
    destroy() {
      target.removeEventListener("pointerdown", onDown);
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      target.removeEventListener("pointercancel", onUp);
      subs.clear();
      active.clear();
    },
  };
}
