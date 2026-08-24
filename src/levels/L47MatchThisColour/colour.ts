/**
 * Just enough colour science for L47.
 *
 * The level asks you to match a swatch with HSL sliders while the target is
 * quoted as an RGB hex, and the honest solve is to ignore both and watch a
 * single delta number fall. That number has to be real, so this is a genuine
 * CIE76 ΔE over CIELAB rather than a distance in RGB — an RGB distance would
 * make the readout disagree with your eyes in a way that is unfair rather than
 * instructive.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** h in [0,360), s and l in [0,100]. */
export function hslToRgb(h: number, s: number, l: number): Rgb {
  const S = s / 100;
  const L = l / 100;
  const c = (1 - Math.abs(2 * L - 1)) * S;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r1, g1, b1] =
    hp < 1 ? [c, x, 0] :
    hp < 2 ? [x, c, 0] :
    hp < 3 ? [0, c, x] :
    hp < 4 ? [0, x, c] :
    hp < 5 ? [x, 0, c] :
             [c, 0, x];
  const m = L - c / 2;
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

export function toHex({ r, g, b }: Rgb): string {
  const part = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`.toUpperCase();
}

interface Lab {
  L: number;
  a: number;
  b: number;
}

/** sRGB → CIELAB, D65. */
export function rgbToLab({ r, g, b }: Rgb): Lab {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const R = lin(r), G = lin(g), B = lin(b);

  const x = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / 0.95047;
  const y = R * 0.2126729 + G * 0.7151522 + B * 0.072175;
  const z = (R * 0.0193339 + G * 0.119192 + B * 0.9503041) / 1.08883;

  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x), fy = f(y), fz = f(z);

  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

/** CIE76. Good enough to be honest, simple enough to be obviously correct. */
export function deltaE(a: Rgb, b: Rgb): number {
  const A = rgbToLab(a);
  const B = rgbToLab(b);
  return Math.hypot(A.L - B.L, A.a - B.a, A.b - B.b);
}

/**
 * Generous on purpose. The difficulty of this level is not precision — it is
 * not thrashing, and a tight tolerance would punish the wrong thing.
 */
export const TOLERANCE = 12;
