import { ImageResponse } from "next/og";
import { LOGO_INK, logoSvg } from "@/ui/logo/pixels";

/**
 * The iOS home-screen icon.
 *
 * Separate from the manifest's set because iOS ignores the manifest for this
 * and reads `apple-touch-icon` instead — and it does not round the corners of
 * a transparent icon, it composites it onto white. Hence the explicit
 * background: without it the mark's dark frame would sit on a white square and
 * lose the window it is drawing.
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const mark = Math.round(size.width * 0.84);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0B0E13",
        }}
      >
        <img
          src={`data:image/svg+xml;utf8,${encodeURIComponent(logoSvg(LOGO_INK))}`}
          width={mark}
          height={mark}
          alt=""
        />
      </div>
    ),
    size,
  );
}
