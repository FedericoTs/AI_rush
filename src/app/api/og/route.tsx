import { ImageResponse } from "next/og";
import { CATALOG } from "@/levels/catalog";
import { siteHost } from "@/lib/site";
import { CURSOR_H, CURSOR_W, cursorSvg } from "@/ui/logo/cursor";
import { logoSvg } from "@/ui/logo/pixels";
import { ARCHIVO_BLACK, INTER_REGULAR } from "./font";

/**
 * The share card.
 *
 * It gets about a second in a timeline, next to somebody's post that already
 * carries the score and the level that killed them. So its job is not to
 * repeat that — it is to make a stranger understand, before they scroll past,
 * that this is a game about interfaces behaving badly.
 *
 * Which is why it is not a wordmark on a background. It is a desktop that has
 * gone wrong: four slop dialogs thrown across it at angles nothing laid out,
 * overlapping, each one a real level's worth of nonsense — a green Cancel next
 * to a red Continue, a progress bar going backwards, a password field that
 * cannot be satisfied, a verification code the assistant has changed its mind
 * about twice. The pixel cursor is parked on the red button.
 *
 * The wordmark sits under all of it on a hazard slab, because the card has to
 * survive being 300px wide in a feed, and at that size the only things left
 * are the shape of the pile and the two words.
 */

const WRITTEN = 48;
const INK = "#E9EEF4";
const DIM = "#8593A5";
const HAZARD = "#FF4A2B";
const LINE = "#232B37";
const BG = "#0B0E13";

const dataUri = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

/** Ruled paper, drawn as real lines: satori has no repeating-gradient. */
function grid() {
  const lines = [];
  for (let x = 60; x < 1200; x += 60) {
    lines.push(
      <div
        key={`v${x}`}
        style={{ position: "absolute", left: x, top: 0, width: 1, height: 675, background: "rgba(233,238,244,0.028)" }}
      />,
    );
  }
  for (let y = 60; y < 675; y += 60) {
    lines.push(
      <div
        key={`h${y}`}
        style={{ position: "absolute", left: 0, top: y, width: 1200, height: 1, background: "rgba(233,238,244,0.028)" }}
      />,
    );
  }
  return lines;
}

/** One slop dialog, thrown down at whatever angle it landed at. */
function Card({
  x, y, rot, w, title, children,
}: {
  x: number; y: number; rot: number; w: number; title: string; children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        display: "flex",
        flexDirection: "column",
        transform: `rotate(${rot}deg)`,
        background: "#FFFFFF",
        borderRadius: 14,
        padding: "16px 18px",
        boxShadow: "0 24px 60px -20px rgba(0,0,0,0.85)",
      }}
    >
      <div style={{ display: "flex", fontSize: 20, fontWeight: 700, color: "#111827", marginBottom: 10 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

/** Big enough to read at 300px wide, which is the size that actually ships. */
const CURSOR_SCALE = 3.4;

export function GET() {
  const cursor = dataUri(cursorSvg());
  const mark = dataUri(logoSvg());

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: BG,
          position: "relative",
          fontFamily: "Inter",
        }}
      >
        {grid()}

        {/* ── the pile ─────────────────────────────────────────── */}

        {/* A progress bar that has gone backwards. */}
        <Card x={628} y={46} rot={-7} w={330} title="Loading your dashboard…">
          <div style={{ display: "flex", width: "100%", height: 12, borderRadius: 6, background: "#E5E7EB" }}>
            <div style={{ display: "flex", width: "13%", height: 12, borderRadius: 6, background: "#7C3AED" }} />
          </div>
          <div style={{ display: "flex", fontSize: 15, color: "#9CA3AF", marginTop: 8 }}>
            99% · 12% · almost there!
          </div>
        </Card>

        {/* Requirements that cannot all be true at once. */}
        <Card x={846} y={286} rot={6} w={318} title="Password requirements">
          {[
            ["✅", "At least 8 characters", "#059669"],
            ["⬜", "A prime number of vowels", "#9CA3AF"],
            ["⬜", "Must not contain today", "#9CA3AF"],
          ].map(([mark_, text, colour]) => (
            <div key={text} style={{ display: "flex", fontSize: 16, color: colour, marginBottom: 4 }}>
              {mark_} {text}
            </div>
          ))}
        </Card>

        {/* An assistant that has changed its mind twice. */}
        <Card x={598} y={452} rot={3} w={342} title="Your verification code">
          <div style={{ display: "flex", fontSize: 16, color: "#4B5563", lineHeight: 1.4 }}>
            Your code is 481516. Wait — actually 233761. Apologies, one correction: 902244.
          </div>
        </Card>

        {/* The thesis, on top of the pile, with the cursor on the red one. */}
        <Card x={548} y={168} rot={-2} w={368} title="Ready to get started? ✨">
          <div style={{ display: "flex", gap: 12 }}>
            <div
              style={{
                display: "flex", flex: 1, justifyContent: "center",
                background: "#DCFCE7", color: "#15803D", borderRadius: 10,
                padding: "12px 0", fontSize: 19, fontWeight: 700,
              }}
            >
              Cancel
            </div>
            <div
              style={{
                display: "flex", flex: 1, justifyContent: "center",
                background: "#EF4444", color: "#FFFFFF", borderRadius: 10,
                padding: "12px 0", fontSize: 19, fontWeight: 700,
              }}
            >
              ⚠ Continue
            </div>
          </div>
        </Card>

        {/*
          * Parked on the destructive button, because that is the answer.
          *
          * The tip is the top-left pixel of the sprite, so the coordinates
          * below are where it is *pointing* — the lower right of the red
          * button, clear of its label and unambiguously inside it.
          */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cursor}
          width={CURSOR_W * CURSOR_SCALE}
          height={CURSOR_H * CURSOR_SCALE}
          alt=""
          style={{ position: "absolute", left: 870, top: 243 }}
        />

        {/* ── the mark, under all of it ────────────────────────── */}
        <div
          style={{
            position: "absolute",
            left: 56,
            top: 132,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mark} width={54} height={54} alt="" />
            <div style={{ display: "flex", fontSize: 19, letterSpacing: "0.2em", color: DIM }}>
              HOSTILE INTERFACE SPEEDRUN
            </div>
          </div>

          <div
            style={{
              display: "flex",
              fontFamily: "Archivo Black",
              fontSize: 116,
              letterSpacing: "-0.03em",
              lineHeight: 0.9,
              color: INK,
            }}
          >
            AI
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: "Archivo Black",
              fontSize: 116,
              letterSpacing: "-0.03em",
              lineHeight: 0.96,
              color: HAZARD,
            }}
          >
            RUSH
          </div>

          <div style={{ display: "flex", fontSize: 27, color: INK, marginTop: 22, maxWidth: 430, lineHeight: 1.3 }}>
            Every one is solvable. None of them are fair.
          </div>
        </div>

        {/* The sticker. The only thing on the card that ignores the grid. */}
        <div
          style={{
            position: "absolute",
            left: 384,
            top: 58,
            display: "flex",
            transform: "rotate(9deg)",
            background: HAZARD,
            color: "#140603",
            fontFamily: "Archivo Black",
            fontSize: 52,
            letterSpacing: "-0.02em",
            padding: "12px 20px",
            borderRadius: 6,
          }}
        >
          5:00
        </div>

        {/* ── the footer strip ─────────────────────────────────── */}
        <div
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            width: 1200,
            display: "flex",
            alignItems: "center",
            padding: "18px 56px",
            borderTop: `1px solid ${LINE}`,
            background: "#141922",
            fontSize: 20,
            letterSpacing: "0.12em",
            color: DIM,
          }}
        >
          <div style={{ display: "flex" }}>
            {CATALOG.length}/{WRITTEN} BUILT · SOLVE OR SKIP · THE CLOCK DOES NOT STOP
          </div>
          <div style={{ display: "flex", flex: 1 }} />
          <div style={{ display: "flex", color: INK }}>{siteHost()}</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 675,
      headers: {
        /*
         * An hour at the edge, and a week of serving the stale copy while a
         * fresh one is fetched behind it.
         *
         * Not `immutable`, even though the URL is versioned: the footer counts
         * how many levels are built, and that number should catch up on its
         * own within the hour rather than waiting for somebody to remember to
         * bump `OG_VERSION`. The version exists for *art* changes, which are
         * the ones an unfurler will otherwise never show — see `lib/site.ts`.
         */
        "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=604800",
      },
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
