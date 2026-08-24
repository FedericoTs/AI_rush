"use client";

import { useMemo, useState } from "react";
import type { LevelModule, LevelProps } from "@/engine/types";
import { meta } from "./meta";
import { CouplingGraph, type ControlState } from "@/engine/coupling/graph";
import { SlopBadge, SlopCard, SlopCta, SlopFooter, SlopHeading, SlopHint, SlopMicrocopy } from "@/ui/slop/Slop";
import { FOOTER_LINKS, slopSubhead } from "@/ui/slop/phrases";
import s from "./styles.module.css";

export const IDS = ["brightness", "contrast", "saturation"] as const;
const LABELS: Record<string, string> = {
  brightness: "Brightness",
  contrast: "Contrast",
  saturation: "Saturation",
};

export const BUDGET = 150;
export const TARGET: ControlState = { brightness: 80, contrast: 45, saturation: 25 };
/** Generous, because this is a convergence task and thrash is the difficulty. */
export const TOLERANCE = 3;

/** Every slider takes from every other one. Declared both ways, deliberately. */
export function displayGraph(): CouplingGraph {
  return new CouplingGraph(
    IDS.map((id) => ({ id, min: 0, max: BUDGET })),
    IDS.flatMap((from) =>
      IDS.filter((to) => to !== from).map((to) => ({ from, to, kind: "redistribute" as const })),
    ),
  );
}

export const settled = (state: ControlState) =>
  IDS.every((id) => Math.abs(state[id]! - TARGET[id]!) <= TOLERANCE);

/**
 * Three sliders that sum to a constant.
 *
 * Raise one and the other two fall to compensate, split in proportion to what
 * they currently hold. That leaves two real degrees of freedom, not three — the
 * third value is always whatever is left over — and it means every correction
 * you make disturbs the correction before it.
 *
 * So this is a convergence task, and the honest solve is patience with a method:
 * pull each slider to its marker, then go round again. It lands in about two
 * passes from anywhere. What loses the time is over-correcting — treating each
 * slider as independent, chasing a value backwards, and never letting the
 * system settle. The markers keep progress legible the whole way, and there is
 * no fail state; the clock is the entire pressure.
 *
 * ── A deviation from LEVELS.md, on purpose ──────────────────────────────
 *
 * The written spec says the solve is "set the largest target first and work
 * down", because "descending order converges and ascending order oscillates".
 * That is not true, and the test alongside this measured it rather than
 * assuming: over two thousand seeded starts both orderings converge, in an
 * identical 1.5 sweeps on average. It could hardly be otherwise — with the sum
 * pinned, fixing two values fixes the third whichever way round you go.
 *
 * The claim was worth checking rather than implementing. A level whose
 * advertised escape does not work is not a hard level, it is a broken one, and
 * the ordering test is kept in the suite so nobody re-adds the claim later.
 */
function Component({ onSolve, rng, sfx }: LevelProps) {
  const graph = useMemo(() => displayGraph(), []);

  const [state, setState] = useState<ControlState>(() => {
    /* Somewhere on the simplex, away from the answer, drawn from the seed. */
    const a = rng.range(20, 90);
    const b = rng.range(10, BUDGET - a - 10);
    const start = { brightness: a, contrast: b, saturation: BUDGET - a - b };
    return settled(start) ? { brightness: 20, contrast: 20, saturation: BUDGET - 40 } : start;
  });
  const [sub] = useState(() => slopSubhead(rng));

  const nudge = (id: string, delta: number) => {
    setState((prev) => graph.apply(prev, id, delta));
    sfx.blip();
  };

  const done = settled(state);

  return (
    <SlopCard>
      <SlopBadge>Display · Enterprise-Ready</SlopBadge>
      <SlopHeading>Display Settings 🖥️</SlopHeading>
      <SlopMicrocopy>{sub}</SlopMicrocopy>

      <div className={s.sliders}>
        {IDS.map((id) => {
          const value = state[id]!;
          const want = TARGET[id]!;
          const ok = Math.abs(value - want) <= TOLERANCE;
          return (
            <div className={s.slider} key={id}>
              <div className={s.head}>
                <span>{LABELS[id]}</span>
                <b className={ok ? s.ok : undefined} data-testid={`value-${id}`}>{value}</b>
              </div>
              <div className={s.track}>
                <div className={s.fill} style={{ width: `${(value / BUDGET) * 100}%` }} />
                <div className={s.marker} style={{ left: `${(want / BUDGET) * 100}%` }} aria-hidden="true" />
                <input
                  className={s.range}
                  type="range"
                  min={0}
                  max={BUDGET}
                  value={value}
                  aria-label={LABELS[id]}
                  data-testid={`slider-${id}`}
                  onChange={(e) => nudge(id, Number(e.target.value) - value)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowUp" || e.key === "ArrowRight") { e.preventDefault(); nudge(id, 1); }
                    else if (e.key === "ArrowDown" || e.key === "ArrowLeft") { e.preventDefault(); nudge(id, -1); }
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className={s.budget}>
        Total display budget: {IDS.reduce((n, id) => n + state[id]!, 0)} / {BUDGET}
      </div>

      <SlopCta onClick={() => done && onSolve()} disabled={!done}>
        {done ? "Apply Settings" : "Settings not yet balanced"}
      </SlopCta>
      <SlopHint>
        Your display has a fixed rendering budget. Increasing one setting reduces the others to
        compensate, proportionally — so your third setting is always calculated for you. ⚖️
      </SlopHint>
      <SlopFooter links={FOOTER_LINKS} />
    </SlopCard>
  );
}

export const L44: LevelModule = { meta, Component };
