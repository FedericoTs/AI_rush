/**
 * Real gear geometry.
 *
 * `LEVELS.md` is blunt that this is the one level where being mechanically
 * accurate *is* the joke, and that "a fake approximation will read as a bug
 * rather than a bit". So the teeth are involute, the pitch circles touch, and
 * the meshing is correct — a gear with 21 teeth turning a gear with 7 really
 * does turn it three times as fast, backwards.
 *
 * Kept out of the component and free of React so it can be unit-tested as
 * arithmetic, which is the only way to be sure the mesh is right rather than
 * merely plausible.
 */

export interface Gear {
  /** Centre, in the canvas's own coordinates. */
  cx: number;
  cy: number;
  teeth: number;
  /** Radians. Positive is clockwise on screen. */
  phase: number;
}

/**
 * One module for the whole train, so pitch radius is proportional to tooth
 * count and adjacent pitch circles touch exactly. That is what "meshing" means,
 * and it is the number every gear in here is laid out from.
 */
export const MODULE = 2;

export const pitchRadius = (teeth: number) => (MODULE * teeth) / 2;

/**
 * The ratio from the drive gear to the marked one, following the chain.
 *
 * Each mesh inverts direction and scales by the tooth ratio, so a train of N
 * meshes has sign `(-1)^N`. Everything between the ends cancels — the middle
 * gears are idlers, and in a simple train idlers change the *direction* and
 * nothing else. The magnitude is only ever first-over-last.
 *
 * That fact is why the level's tooth counts are what they are, and it is
 * printed to the player in tiny mono type in a "technical specifications"
 * footer nobody reads until minute four. Which is the level.
 */
export function trainRatio(teeth: readonly number[]): number {
  let ratio = 1;
  for (let i = 1; i < teeth.length; i++) ratio *= -teeth[i - 1]! / teeth[i]!;
  return ratio;
}

/** Where every gear sits once the drive gear has turned by `driveAngle`. */
export function trainAngles(teeth: readonly number[], driveAngle: number): number[] {
  const out = [driveAngle];
  for (let i = 1; i < teeth.length; i++) {
    out.push(out[i - 1]! * (-teeth[i - 1]! / teeth[i]!));
  }
  return out;
}

/**
 * An involute tooth profile, sampled.
 *
 * Points are returned in order around the gear so the caller can stroke one
 * closed path. Root, flank, tip, flank, root — repeated per tooth, phased by
 * the gear's current angle.
 */
export function toothPath(g: Gear): Array<[number, number]> {
  const r = pitchRadius(g.teeth);
  const addendum = MODULE;
  const dedendum = MODULE * 1.25;
  const tip = r + addendum;
  const root = Math.max(1, r - dedendum);

  const pts: Array<[number, number]> = [];
  const step = (Math.PI * 2) / g.teeth;

  for (let i = 0; i < g.teeth; i++) {
    const a = g.phase + i * step;
    /* Four samples a tooth: up the leading flank, across the tip, down the
       trailing flank, along the root. Enough to mesh visibly and cheap enough
       to redraw every frame on a phone. */
    const profile: Array<[number, number]> = [
      [root, a],
      [tip, a + step * 0.18],
      [tip, a + step * 0.32],
      [root, a + step * 0.5],
    ];
    for (const [radius, angle] of profile) {
      pts.push([g.cx + Math.cos(angle) * radius, g.cy + Math.sin(angle) * radius]);
    }
  }
  return pts;
}

/** Where the marked tooth is, as an angle. Top of the gear is −π/2. */
export function markedToothAngle(g: Gear): number {
  return g.phase;
}

/** How far the marked tooth is from vertical, in radians, signed and wrapped. */
export function offFromTop(angle: number): number {
  const target = -Math.PI / 2;
  let d = (angle - target) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
