"use client";

import { useEffect, useRef, useState } from "react";
import type { LevelModule, LevelProps } from "@/engine/types";
import { meta } from "./meta";
import { SlopBadge, SlopCard, SlopFooter, SlopHeading, SlopHint } from "@/ui/slop/Slop";
import { FOOTER_LINKS } from "@/ui/slop/phrases";
import s from "./styles.module.css";

/** How long each cursor holds the truth before they trade. */
const SWAP_MS = 5000;
/** The tell. Long enough to catch, short enough to miss. */
const FLICKER_MS = 200;

const FIELDS = [
  { id: "a", label: "Preferred name" },
  { id: "b", label: "Time zone" },
  { id: "c", label: "How did you hear about us?" },
] as const;

const GARBAGE = ["¿?¿?", "NULL", "undefined", "[object Object]", "&nbsp;", "ERR_NO_INPUT"];

/**
 * A trivial three-field form. Your hand drives two cursors.
 *
 * One is real and one is a mirrored decoy, and every five seconds they trade
 * which is which — announced by nothing except a two-hundred-millisecond
 * flicker that you will miss the first three times. Clicking with the wrong
 * one fills a field with garbage.
 *
 * Two honest solves, and finding either is the level. Watch for the flicker
 * and do your clicking in the first second of each window, when you know which
 * is which. Or notice that the two cursors are mirrored about the centre line,
 * park them so that *both* land on the same control, and click through the
 * ambiguity without ever needing to know which one is real — which is much the
 * cleverer answer and completely intended.
 *
 * A Clear button exists and is never hidden. Garbage in a field is a setback,
 * not a death, and a level whose failure state is unrecoverable would be a
 * different and much worse level.
 */
function Component({ onSolve, onFail, rng, sfx }: LevelProps) {
  const [values, setValues] = useState<Record<string, string>>({ a: "", b: "", c: "" });
  const [primaryReal, setPrimaryReal] = useState(() => rng.chance(0.5));
  const [flicker, setFlicker] = useState(false);
  /* Position *and* the mirror line, both measured in the pointer handler.
     Reading the element during render would be a ref access in render — and
     would also be wrong on the first frame, before layout. */
  const [pos, setPos] = useState<{ x: number; y: number; mirror: number } | null>(null);
  const stage = useRef<HTMLDivElement | null>(null);

  /* The trade, on a timer, with the flicker as its only announcement. */
  useEffect(() => {
    const id = setInterval(() => {
      setFlicker(true);
      setPrimaryReal((r) => !r);
      setTimeout(() => setFlicker(false), FLICKER_MS);
    }, SWAP_MS);
    return () => clearInterval(id);
  }, []);

  const onMove = (e: React.PointerEvent) => {
    const box = stage.current?.getBoundingClientRect();
    if (!box) return;
    setPos({ x: e.clientX - box.left, y: e.clientY - box.top, mirror: box.width });
  };

  /**
   * Which cursor is over this point.
   *
   * The decoy is the mirror of the real one about the vertical centre, so a
   * click always lands somewhere — the question is only whether it lands where
   * you meant. `real` is the pointer itself when the primary is real, and its
   * reflection otherwise.
   */
  const clickIsReal = (): boolean => primaryReal;

  const fill = (id: string, value: string) => {
    if (clickIsReal()) {
      setValues((v) => ({ ...v, [id]: value }));
      sfx.click();
      return;
    }
    /* The decoy clicked. Something gets filled — just not by you. */
    const wrong = FIELDS.filter((f) => f.id !== id);
    const victim = wrong[rng.int(wrong.length)]!;
    setValues((v) => ({ ...v, [victim.id]: GARBAGE[rng.int(GARBAGE.length)]! }));
    sfx.fail();
    onFail("decoy-cursor");
  };

  const complete = FIELDS.every(
    (f) => values[f.id]!.length > 0 && !GARBAGE.includes(values[f.id]!),
  );

  return (
    <SlopCard>
      <SlopBadge>Profile · Zero-Trust</SlopBadge>
      <SlopHeading>Finish setting up your account 🖱️</SlopHeading>

      <div className={s.stage} ref={stage} onPointerMove={onMove} data-testid="l25-stage">
        {FIELDS.map((f) => (
          <div className={s.field} key={f.id}>
            <span className={s.label}>{f.label}</span>
            <div className={s.slots}>
              {["Yes", "No", "Later"].map((opt) => (
                <button
                  type="button"
                  key={opt}
                  className={`${s.opt} ${values[f.id] === opt ? s.optOn : ""}`}
                  aria-label={`${f.label}: ${opt}`}
                  onClick={() => fill(f.id, opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
            <span className={s.value} data-field={f.id}>
              {values[f.id] || "—"}
            </span>
          </div>
        ))}

        {/* The two pointers. Mirrored about the centre line, which is what
            makes parking them on the same control a real strategy. */}
        {pos && (
          <>
            <span
              className={`${s.cursor} ${primaryReal ? s.real : s.decoy} ${flicker ? s.flick : ""}`}
              style={{ left: pos.x, top: pos.y }}
              aria-hidden="true"
            />
            <span
              className={`${s.cursor} ${primaryReal ? s.decoy : s.real} ${flicker ? s.flick : ""}`}
              style={{ left: pos.mirror - pos.x, top: pos.y }}
              aria-hidden="true"
            />
          </>
        )}
      </div>

      <div className={s.bar}>
        <button
          type="button"
          className={s.clear}
          onClick={() => {
            setValues({ a: "", b: "", c: "" });
            sfx.thud();
          }}
        >
          Clear
        </button>
        <button
          type="button"
          className={s.cta}
          disabled={!complete}
          onClick={() => {
            sfx.solve();
            onSolve();
          }}
        >
          {complete ? "Save profile" : "Answer all three"}
        </button>
      </div>

      <SlopHint>
        Pointer acceleration is handled by our input layer for a smoother, more responsive feel.
        🖱️
      </SlopHint>
      <SlopFooter links={FOOTER_LINKS} />
    </SlopCard>
  );
}

export const L25: LevelModule = { meta, Component };
