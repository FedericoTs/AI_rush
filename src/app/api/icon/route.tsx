import { ImageResponse } from "next/og";
import { LOGO_INK, logoSvg } from "@/ui/logo/pixels";

/**
 * The home-screen icon, at whatever size the platform asked for.
 *
 * Rendered rather than committed as a set of PNGs, for one reason: the mark is
 * a 16×16 grid, and the only way it stays crisp is if every size is an exact
 * integer multiple of 16 with no resampling in between. A checked-in PNG gets
 * resized by whatever tool touched it last; this cannot.
 *
 * `next/og` is already in the build for the share card, and it renders the same
 * SVG the favicon and the wordmark use — so there is exactly one drawing of
 * this mark in the repository and no way for an icon to drift from it.
 */

const BG = "#0B0E13";
const dataUri = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

/*
 * Android maskable icons are cropped to whatever shape the launcher likes — a
 * circle, a squircle, a teardrop — and only a circle of 80% diameter is
 * guaranteed to survive. This mark is a filled square, so the number that
 * matters is not its width but its *diagonal*: the largest square that fits
 * inside that circle has a side of 0.8/√2 ≈ 0.566 of the icon. Anything wider
 * loses its corners on a round launcher, which for this mark means losing the
 * frame that makes it a window.
 */
const SAFE = 0.55;
const FULL = 0.84;

const SIZES = new Set([180, 192, 256, 384, 512]);

export function GET(req: Request) {
  const url = new URL(req.url);
  const asked = Number(url.searchParams.get("size"));
  const size = SIZES.has(asked) ? asked : 512;
  const maskable = url.searchParams.get("maskable") === "1";

  const mark = Math.round(size * (maskable ? SAFE : FULL));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BG,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={dataUri(logoSvg(LOGO_INK))} width={mark} height={mark} alt="" />
      </div>
    ),
    {
      width: size,
      height: size,
      headers: {
        /* Immutable in practice: the mark changes about once. A launcher that
           has cached this is doing the right thing. */
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    },
  );
}
