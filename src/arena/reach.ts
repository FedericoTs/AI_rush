/**
 * Which pixel a grid coordinate actually means.
 *
 * A cell is 10×30 px at the viewport the Arena uses, and plenty of real
 * controls are shorter than that: a toggle switch is 19px tall, a footer link
 * 14, a checkbox 16. The cell centre we publish for one of those can sit up to
 * fifteen pixels above or below it and still be the nearest cell there is — so
 * the coordinate is right, and clicking its exact centre misses.
 *
 * A sweep of all forty-nine levels found eighty-nine of these. It also
 * explains something a blind run reported and could not account for: six
 * clicks on L05's six toggles moved the counter by four. Two of them missed,
 * and the agent — with no way to see which — spent the rest of the level
 * reasoning from a state that had never existed.
 *
 * ── Why this is not a helping hand ───────────────────────────────────────
 *
 * The fix is bounded to the cell the agent aimed at, and that boundary is what
 * keeps it honest. It does not search for a nearby control, it does not pick
 * the "obvious" target, and it will not save a click aimed one cell off. It
 * says only: within the ten by thirty pixels you actually named, land on the
 * thing that is there.
 *
 * Which is also what a real touchscreen does. A fingertip is about nine
 * millimetres across and every mobile browser resolves a tap to the best
 * target under it; this slop is smaller than that. The agent is being given a
 * fingertip, not a hint.
 */

/** What counts as a control, for both the harness and the sweep that checks it. */
export const INTERACTIVE =
  "button, a, input, textarea, select, [role=button], [role=switch], [role=spinbutton], [role=slider]";

/**
 * Runs in the page. Self-contained, because it is serialised by
 * `page.evaluate` and has no module scope on the other side.
 *
 * Returns the point to act on: the one asked for when something is already
 * there, otherwise the nearest control-bearing point inside that same cell.
 */
export function resolvePoint(
  [x, y, cw, ch, selector]: [number, number, number, number, string],
): [number, number] {
  const isControl = (el: Element | null): boolean => {
    if (!el) return false;
    if (el.closest(selector)) return true;
    const c = getComputedStyle(el).cursor;
    return c === "pointer" || c.endsWith("-resize") || c === "grab" || c === "grabbing";
  };

  if (isControl(document.elementFromPoint(x, y))) return [x, y];

  let best: [number, number] | null = null;
  let bestDistance = Infinity;

  /* A lattice over the agent's own cell, nothing beyond it. Three pixels is
     finer than any control this misses and keeps the scan to a few dozen
     lookups. */
  for (let dy = -ch / 2; dy <= ch / 2; dy += 3) {
    for (let dx = -cw / 2; dx <= cw / 2; dx += 3) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= window.innerWidth || ny >= window.innerHeight) continue;
      if (!isControl(document.elementFromPoint(nx, ny))) continue;
      const d = dx * dx + dy * dy;
      if (d < bestDistance) {
        bestDistance = d;
        best = [nx, ny];
      }
    }
  }

  /* Nothing in the cell at all: act where you were told, and miss. An agent
     that aimed at empty space should find out that it did. */
  return best ?? [x, y];
}
