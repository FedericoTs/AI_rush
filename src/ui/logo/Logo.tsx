import { LOGO_SIZE, logoPixels } from "./pixels";
import s from "./logo.module.css";

const CELLS = logoPixels();

/**
 * The mark, drawn from the grid rather than from a file.
 *
 * Colours come from CSS variables so it inherits the chrome, and
 * `shape-rendering: crispEdges` keeps the pixels square at every size — a
 * pixel mark that antialiases at 96px is just a blurry mark.
 *
 * The red button blinks, slowly and rarely, like a cursor in a terminal
 * nobody is using. It is the one moving thing on an otherwise still logo and
 * it stops entirely under reduced motion.
 */
export function Logo({ size = 32, blink = false }: { size?: number; blink?: boolean }) {
  return (
    <svg
      className={`${s.logo} ${blink ? s.blink : ""}`}
      width={size}
      height={size}
      viewBox={`0 0 ${LOGO_SIZE} ${LOGO_SIZE}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label="AI Rush"
    >
      {CELLS.map((p, i) => (
        <rect
          key={i}
          x={p.x}
          y={p.y}
          width={p.w}
          height={1}
          className={s[p.fill]}
          data-ink={p.fill}
        />
      ))}
    </svg>
  );
}
