/**
 * The mark: a dialog box whose red button does not fit inside it.
 *
 * Drawn as a 16×16 pixel grid rather than a curve, because everything else
 * about this product's chrome is ruled to a grid and a swooshy vector mark
 * would be the one thing on the page that came from a different game.
 *
 * The joke is the whole identity. Every level in here is an ordinary
 * interface with one thing wrong, and the smallest possible version of that is
 * a window with a friendly green button on the left, a destructive red one on
 * the right, and the red one bursting through the frame because nobody checked
 * it would fit. At sixteen pixels it still reads: a little window, a green
 * dot, a red dot escaping.
 *
 * Legend:
 *   `.` nothing   `#` frame   `-` body text   `g` the safe button
 *   `r` the one that does not fit
 */
export const LOGO_GRID = [
  "................",
  ".##############.",
  ".#............#.",
  ".#.--.--......#.",
  ".#............#.",
  ".#.------.....#.",
  ".#.----.......#.",
  ".#............#.",
  ".#............#.",
  ".#............#.",
  ".#.gggg..rrrrrrr",
  ".#.gggg..rrrrrrr",
  ".#.gggg..rrrrrrr",
  ".#............#.",
  ".##############.",
  "................",
] as const;

export const LOGO_SIZE = LOGO_GRID.length;

export interface LogoInk {
  frame: string;
  text: string;
  good: string;
  hazard: string;
}

export const LOGO_INK: LogoInk = {
  frame: "#E9EEF4",
  text: "#5D6A7A",
  good: "#28C08A",
  hazard: "#FF4A2B",
};

const PAINT: Record<string, keyof LogoInk> = {
  "#": "frame",
  "-": "text",
  g: "good",
  r: "hazard",
};

export interface Cell<K extends string = string> {
  x: number;
  y: number;
  w: number;
  fill: K;
}

/**
 * An ASCII grid as a flat list of coloured cells.
 *
 * Runs of the same character on one row are merged into a single wider cell —
 * 16×16 is 256 rects drawn naively and about 40 drawn this way, which matters
 * on the share card where every element is laid out by hand. Characters with
 * no entry in `paint` are holes and emit nothing.
 */
export function runs<K extends string>(
  grid: readonly string[],
  paint: Record<string, K>,
): Array<Cell<K>> {
  const out: Array<Cell<K>> = [];

  grid.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x]!;
      const fill = paint[ch];
      if (!fill) {
        x++;
        continue;
      }
      let w = 1;
      while (row[x + w] === ch) w++;
      out.push({ x, y, w, fill });
      x += w;
    }
  });

  return out;
}

export type Pixel = Cell<keyof LogoInk>;

export function logoPixels(): Pixel[] {
  return runs(LOGO_GRID, PAINT);
}

/**
 * The mark as a standalone SVG string.
 *
 * Used for the favicon and for the share card, where the renderer cannot take
 * a React component and a data URI is the only way in.
 */
export function logoSvg(ink: LogoInk = LOGO_INK, background?: string): string {
  const cells = logoPixels()
    .map((p) => `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="1" fill="${ink[p.fill]}"/>`)
    .join("");

  const bg = background
    ? `<rect width="${LOGO_SIZE}" height="${LOGO_SIZE}" rx="2" fill="${background}"/>`
    : "";

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LOGO_SIZE} ${LOGO_SIZE}" ` +
    `shape-rendering="crispEdges">${bg}${cells}</svg>`
  );
}
