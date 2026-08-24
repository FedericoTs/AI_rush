import type { ModifierId } from "../types";

export interface ModifierSpec {
  id: ModifierId;
  label: string;
  /** One line, for the share card badge and the level index. */
  blurb: string;
  /** Removed in Mercy Mode (GAME_DESIGN.md §8). */
  mercyOff: boolean;
}

/**
 * Modifiers compose over *any* level as CSS custom properties on a wrapper.
 * No level implements one itself.
 *
 * Two limits are baked into the specs rather than left to a final audit:
 * `rainbow` hue-rotates at 0.4 Hz and nothing anywhere strobes above 3 Hz.
 */
export const MODIFIERS: Record<ModifierId, ModifierSpec> = {
  drift:    { id: "drift",    label: "Drifting",   blurb: "The card slowly wanders off screen.",            mercyOff: false },
  confetti: { id: "confetti", label: "Confetti",   blurb: "Particle rain obscures the level.",              mercyOff: false },
  rainbow:  { id: "rainbow",  label: "Rainbow",    blurb: "Everything hue-rotates at 0.4 Hz.",              mercyOff: false },
  shrink:   { id: "shrink",   label: "Shrinking",  blurb: "The card scales to 60% and back.",               mercyOff: false },
  comic:    { id: "comic",    label: "Comic Sans", blurb: "Every font becomes Comic Sans.",                 mercyOff: false },
  slippery: { id: "slippery", label: "Slippery",   blurb: "Draggables overshoot their target.",             mercyOff: false },
  popups:   { id: "popups",   label: "Popups",     blurb: "A dismissible popup every eight seconds.",       mercyOff: false },
  whisper:  { id: "whisper",  label: "Whisper",    blurb: "A synthesised voice reads the copy aloud.",      mercyOff: false },
  fleeing:  { id: "fleeing",  label: "Fleeing",    blurb: "The primary button avoids your pointer.",        mercyOff: true },
  lag:      { id: "lag",      label: "Lag",        blurb: "350ms of input delay on everything.",            mercyOff: true },
  mirror:   { id: "mirror",   label: "Mirrored",   blurb: "The layout is flipped horizontally.",            mercyOff: true },
  rotate:   { id: "rotate",   label: "Rotated",    blurb: "The card sits at a static 15° tilt.",            mercyOff: true },
};

export const ALL_MODIFIERS = Object.keys(MODIFIERS) as ModifierId[];

export const MERCY_SAFE_MODIFIERS = ALL_MODIFIERS.filter((id) => !MODIFIERS[id].mercyOff);

/** Modifiers begin at 2:00 (GAME_DESIGN.md §5). */
export const MODIFIERS_START_SEC = 120;
export const MAX_CONCURRENT_MODIFIERS = 2;
