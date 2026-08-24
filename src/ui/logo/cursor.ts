import { runs } from "./pixels";

/**
 * The pointer, drawn the same way the mark is.
 *
 * It exists because the share card needs to show a hand about to make a
 * mistake, and there is no way to do that with text. A cursor parked on the
 * destructive button says the whole premise in one glyph: somebody is one
 * click from the wrong outcome and the interface arranged that on purpose.
 *
 * It is deliberately the plain system arrow — 12×17, white with a hard black
 * outline, the same shape every player has been staring at for thirty years.
 * A stylised pointer would read as an illustration; this one reads as
 * *theirs*, which is the point.
 *
 * Legend: `K` outline   `W` fill   `.` nothing
 */
const CURSOR_GRID = [
  "K...........",
  "KK..........",
  "KWK.........",
  "KWWK........",
  "KWWWK.......",
  "KWWWWK......",
  "KWWWWWK.....",
  "KWWWWWWK....",
  "KWWWWWWWK...",
  "KWWWWWWWWK..",
  "KWWWWWWWWWK.",
  "KWWWWWKKKKKK",
  "KWWKWWK.....",
  "KWK.KWWK....",
  "KK...KWWK...",
  "......KWWK..",
  "......KKKK..",
] as const;

export const CURSOR_W = CURSOR_GRID[0].length;
export const CURSOR_H = CURSOR_GRID.length;

/** Where the arrow's tip sits inside the box, in grid cells. */
export const CURSOR_TIP = { x: 0, y: 0 };

const PAINT = { K: "line", W: "fill" } as const;

export interface CursorInk {
  line: string;
  fill: string;
}

export const CURSOR_INK: CursorInk = { line: "#0B0E13", fill: "#FFFFFF" };

/**
 * The pointer as a standalone SVG string, for the share card — which cannot
 * take a React component and only accepts assets as a data URI.
 */
export function cursorSvg(ink: CursorInk = CURSOR_INK): string {
  const cells = runs(CURSOR_GRID, PAINT)
    .map((p) => `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="1" fill="${ink[p.fill]}"/>`)
    .join("");

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CURSOR_W} ${CURSOR_H}" ` +
    `shape-rendering="crispEdges">${cells}</svg>`
  );
}
