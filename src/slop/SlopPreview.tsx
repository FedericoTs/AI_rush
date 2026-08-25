"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useInput } from "@/input/useInput";
import { streamFor } from "@/engine/rng";
import { REGISTRY } from "@/levels/registry";
import type { InputCapability, LevelModule } from "@/engine/types";
import type { SfxHandle } from "@/engine/sfx";
import s from "./slop.module.css";

const BY_ID = new Map(REGISTRY.map((m) => [m.meta.id, m] as const));

/**
 * What a browser can always do. Anything beyond this — a gyroscope, a
 * microphone, a camera — is not being asked for on a page whose entire job is
 * to be looked at, so those levels render the degraded path they already ship
 * for a device without the sensor. Every one of the six has one.
 */
const PREVIEW_CAPS = new Set<InputCapability>(["pointer", "keyboard", "touch"]);

/** Silent. A gallery that beeps at you while you read it is a bad gallery. */
const MUTE: SfxHandle = {
  unlock: () => {}, setMuted: () => {}, muted: true,
  click: () => {}, pick: () => {}, solve: () => {}, fail: () => {},
  skip: () => {}, thud: () => {}, blip: () => {},
};

const NOTHING = () => {};

/* "Have we hydrated yet", asked the way React provides for asking it: a store
   that never changes, whose server snapshot is false and whose client snapshot
   is true. No state, no effect, no cascading render. */
const SUBSCRIBE_NEVER = () => () => {};
const ON_CLIENT = () => true;
const ON_SERVER = () => false;

/**
 * A real level, rendered and unplayable.
 *
 * It is the actual component, not a screenshot and not a description, because
 * the question being asked is whether a real product would ship *this* — and
 * an answer given about a paraphrase is an answer about the paraphrase. It
 * also means the gallery cannot drift from the game: there is one copy of
 * every level and this is it.
 *
 * Inert by three separate means, because one is not enough. `inert` takes the
 * subtree out of the tab order and stops it receiving events at all; the
 * pointer-events rule covers browsers that have not shipped `inert` yet; and
 * `onSolve`/`onFail` are no-ops, so a level that resolves itself on a timer —
 * several do — changes nothing.
 *
 * Levels keep animating on purpose. A progress bar that is still crawling and
 * a spinner that is still spinning are most of what the question is about.
 */
export function SlopPreview({ levelId }: { levelId: string }) {
  /*
   * The gate and the level are separate components on purpose.
   *
   * Nothing in this project has ever server-rendered a level: `RunClient`
   * shows the calibration screen until capability detection resolves in the
   * browser, so a level's first render is always a client render. Mounting one
   * from a page is new, and it throws on the server — not in the level's own
   * render, but in `useInput`, which builds pointer and keyboard adapters in a
   * `useMemo` and reaches for `window` while doing it.
   *
   * A `mounted` flag inside one component would not have helped: hooks cannot
   * be conditional, so `useInput` would still run during the server pass. The
   * hook has to live in a component that only ever exists on the client.
   *
   * The stage reserves its height in CSS, so filling in on hydration moves
   * nothing on the page.
   */
  const mounted = useSyncExternalStore(SUBSCRIBE_NEVER, ON_CLIENT, ON_SERVER);
  if (!mounted || !BY_ID.has(levelId)) return null;
  return <Live levelId={levelId} />;
}

function Live({ levelId }: { levelId: string }) {
  const mod = BY_ID.get(levelId) as LevelModule;
  const missing = mod.meta.requires.filter((c) => !PREVIEW_CAPS.has(c));
  const degraded = missing.length > 0;

  const input = useInput(degraded ? [] : mod.meta.requires, PREVIEW_CAPS);
  /* Fixed seed: everyone looking at this level sees the same one, or they are
     not voting on the same thing. */
  const rng = useMemo(() => streamFor(20260825, levelId), [levelId]);

  const Body = degraded && mod.Fallback ? mod.Fallback : mod.Component;

  return (
    <div className={s.preview} inert data-preview={levelId}>
      <Body
        onSolve={NOTHING}
        onFail={NOTHING}
        rng={rng}
        chaos={[]}
        degraded={degraded}
        input={input}
        sfx={MUTE}
      />
    </div>
  );
}
