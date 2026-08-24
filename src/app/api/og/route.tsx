import { ImageResponse } from "next/og";
import { CATALOG } from "@/levels/catalog";
import { ARCHIVO_BLACK, INTER_REGULAR } from "./font";

/**
 * The share card.
 *
 * It gets about a second in a timeline, next to somebody's post that already
 * carries the personal detail — the score, the level that killed them. So the
 * card's job is not to repeat that. It is to make a stranger understand what
 * they are looking at before they scroll past.
 *
 * Deliberately not a centred wordmark on a gradient. That is the look of every
 * interface inside this game, and it is also the look of every other card in
 * the timeline. This one is a pinboard: ruled paper, a heavy poster wordmark,
 * a sticker at an angle a grid would never produce, and the specimen sheet
 * along the bottom — the same object the front page is built around, so the
 * card and the site are recognisably the same place.
 */

const WRITTEN = 48;
const INK = "#E9EEF4";
const DIM = "#8593A5";
const HAZARD = "#FF4A2B";
const LINE = "#232B37";
const BG = "#0B0E13";

const TIER_COLOR: Record<string, string> = {
  annoying: "#8593A5",
  cursed: "#F0A12E",
  unhinged: "#FF4A2B",
  forbidden: "#A855F7",
};

/** Ruled paper, drawn as real lines: satori has no repeating-gradient. */
function grid() {
  const lines = [];
  for (let x = 60; x < 1200; x += 60) {
    lines.push(
      <div
        key={`v${x}`}
        style={{ position: "absolute", left: x, top: 0, width: 1, height: 675, background: "rgba(233,238,244,0.030)" }}
      />,
    );
  }
  for (let y = 60; y < 675; y += 60) {
    lines.push(
      <div
        key={`h${y}`}
        style={{ position: "absolute", left: 0, top: y, width: 1200, height: 1, background: "rgba(233,238,244,0.030)" }}
      />,
    );
  }
  return lines;
}

export function GET() {
  /* One row of the sheet. Five rather than the whole catalogue: at this size
     more tiles means every title truncated to nonsense, and the strip only has
     to read as a sample of a bigger collection. */
  const strip = CATALOG.slice(0, 5);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: BG,
          position: "relative",
          fontFamily: "Inter",
        }}
      >
        {grid()}

        {/* Masthead, same words as the site's */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "20px 56px",
            borderBottom: `1px solid ${LINE}`,
            background: "#141922",
            fontSize: 19,
            letterSpacing: "0.22em",
            color: DIM,
          }}
        >
          <div style={{ display: "flex" }}>HOSTILE INTERFACE SPEEDRUN</div>
          <div style={{ display: "flex", flex: 1 }} />
          <div style={{ display: "flex", color: INK }}>
            {CATALOG.length}/{WRITTEN} BUILT
          </div>
        </div>

        <div style={{ display: "flex", flex: 1, padding: "44px 56px 0", position: "relative" }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                fontFamily: "Archivo Black",
                fontSize: 116,
                letterSpacing: "-0.03em",
                lineHeight: 0.86,
              }}
            >
              <div style={{ display: "flex", color: INK }}>AI</div>
              <div style={{ display: "flex", color: HAZARD }}>RUSH</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 26, maxWidth: 760 }}>
              <div style={{ display: "flex", fontSize: 30, color: INK, lineHeight: 1.3 }}>
                Interfaces built by something that has seen a million forms and understood
                none of them.
              </div>
              <div style={{ display: "flex", fontSize: 23, color: DIM }}>
                Every one is solvable. None of them are fair.
              </div>
            </div>
          </div>

          {/* The sticker. The only thing on the card that ignores the grid. */}
          <div
            style={{
              position: "absolute",
              top: 52,
              right: 56,
              display: "flex",
              transform: "rotate(7deg)",
              background: HAZARD,
              color: "#140603",
              fontFamily: "Archivo Black",
              fontSize: 58,
              letterSpacing: "-0.02em",
              padding: "14px 24px",
              borderRadius: 6,
            }}
          >
            5:00
          </div>
          <div
            style={{
              position: "absolute",
              top: 152,
              right: 74,
              display: "flex",
              transform: "rotate(-3deg)",
              background: INK,
              color: BG,
              fontSize: 20,
              letterSpacing: "0.16em",
              padding: "8px 14px",
              borderRadius: 4,
            }}
          >
            NO PAUSE
          </div>
        </div>

        {/* The sheet */}
        <div style={{ display: "flex", flexDirection: "column", padding: "0 56px 34px" }}>
          <div style={{ display: "flex", border: `1px solid ${LINE}` }}>
            {strip.map((m, i) => (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  gap: 4,
                  padding: "12px 10px",
                  borderLeft: `3px solid ${TIER_COLOR[m.tier] ?? DIM}`,
                  ...(i > 0 ? { marginLeft: 1 } : {}),
                }}
              >
                <div style={{ display: "flex", fontSize: 15, letterSpacing: "0.1em", color: TIER_COLOR[m.tier] ?? DIM }}>
                  {m.id}
                </div>
                <div style={{ display: "flex", fontSize: 19, color: INK, lineHeight: 1.2 }}>
                  {m.title}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", marginTop: 16, fontSize: 21, letterSpacing: "0.12em", color: DIM }}>
            <div style={{ display: "flex" }}>SOLVE OR SKIP · THE CLOCK DOES NOT STOP EITHER WAY</div>
            <div style={{ display: "flex", flex: 1 }} />
            <div style={{ display: "flex", color: INK }}>ai-rush.vercel.app</div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 675,
      fonts: [
        /* Inter first: satori falls back through this list in order for any
           family it cannot resolve, and a display face at the front of it
           gets used for every glyph it happens to contain. */
        { name: "Inter", data: INTER_REGULAR, weight: 400, style: "normal" },
        { name: "Archivo Black", data: ARCHIVO_BLACK, weight: 400, style: "normal" },
      ],
    },
  );
}
