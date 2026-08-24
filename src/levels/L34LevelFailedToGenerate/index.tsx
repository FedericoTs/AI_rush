"use client";

import { useState } from "react";
import type { LevelModule, LevelProps } from "@/engine/types";
import { meta } from "./meta";
import s from "./styles.module.css";

/** The three pieces of the form the renderer dropped on the floor. */
const PIECES = ["label", "input", "button"] as const;
type Piece = (typeof PIECES)[number];

/** Where each piece belongs, top to bottom. A form is an ordered thing. */
const SLOTS: readonly Piece[] = ["label", "input", "button"];

const PIECE_LABEL: Record<Piece, string> = {
  label: "<label> Email address",
  input: "<input type=email>",
  button: "<button> Verify",
};

const STACK = [
  "Error: could not render <VerificationForm />",
  "    at renderNode (slop-runtime.js:1187:19)",
  "    at reconcileChildren (slop-runtime.js:904:7)",
  "    at generateLevel (level-factory.ts:42:11)",
  "    at <anonymous>",
  "",
  "  Hint: the component tree was emitted but never laid out.",
];

/**
 * The renderer crashed and left the form in pieces on the page.
 *
 * A label floating on its own, an unstyled input somewhere else, a submit
 * button a long way down. They are draggable. Put them back in order — label,
 * input, button — fill the field, and press the button. You are debugging the
 * AI's output by hand, which makes this the most honest level in the game and
 * the reason it sits in the forbidden tier: nothing here is a trick. It is
 * just work, and it is exactly the work.
 *
 * There is no fail state. It is a construction puzzle, and construction
 * puzzles that punish you for putting a piece down are not puzzles.
 *
 * The keyboard path is not a lesser version: focus a piece and use the arrow
 * keys to move it between slots. Everything the pointer can do, arrows can do,
 * because a level whose mechanic is dragging is a level some people cannot
 * play at all.
 */
function Component({ onSolve, rng, sfx }: LevelProps) {
  /* Which piece is in each slot; null is an empty slot. Pieces not in a slot
     are still strewn across the page. */
  const [placed, setPlaced] = useState<Array<Piece | null>>([null, null, null]);
  const [held, setHeld] = useState<Piece | null>(null);
  const [email, setEmail] = useState("");
  const [strewn] = useState(() => rng.shuffle([...PIECES]));

  const loose = strewn.filter((p) => !placed.includes(p));
  const assembled = SLOTS.every((want, i) => placed[i] === want);

  /**
   * A piece lives in exactly one place.
   *
   * Dropping onto an occupied slot swaps the two if the incoming piece came
   * from another slot, and returns the occupant to the floor if it came from
   * there — either way nothing is cloned and nothing vanishes.
   */
  const put = (piece: Piece, slot: number) => {
    setPlaced((prev) => {
      const next = [...prev];
      const was = next.indexOf(piece);
      const displaced = next[slot];
      next[slot] = piece;
      if (was >= 0 && was !== slot) next[was] = displaced ?? null;
      return next;
    });
    setHeld(null);
    sfx.click();
  };

  const pull = (slot: number) => {
    setPlaced((prev) => {
      const next = [...prev];
      next[slot] = null;
      return next;
    });
    sfx.thud();
  };

  /** Arrow keys move a held piece between slots — the whole keyboard path. */
  const onPieceKey = (e: React.KeyboardEvent, piece: Piece) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setHeld((h) => (h === piece ? null : piece));
      sfx.blip();
      return;
    }
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const down = e.key === "ArrowDown";
    const at = placed.indexOf(piece);

    /* Off the floor, a piece takes the nearest empty slot from the end it came
       in from — so three arrow presses on three loose pieces fill the form in
       order, rather than the three of them fighting over slot one. */
    if (at < 0) {
      const free = placed
        .map((held_, i) => (held_ === null ? i : -1))
        .filter((i) => i >= 0);
      if (free.length === 0) return;
      put(piece, down ? free[0]! : free[free.length - 1]!);
      return;
    }

    const next = at + (down ? 1 : -1);
    if (next < 0 || next >= SLOTS.length) {
      pull(at);
      return;
    }
    put(piece, next);
  };

  const submit = () => {
    if (!assembled || !email.includes("@")) return;
    sfx.solve();
    onSolve();
  };

  const renderPiece = (piece: Piece, inSlot: boolean) => {
    if (piece === "label") {
      return <span className={s.pieceLabel}>Email address</span>;
    }
    if (piece === "input") {
      return (
        <input
          className={s.pieceInput}
          value={email}
          aria-label="Email address"
          placeholder={inSlot ? "you@example.com" : ""}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setEmail(e.target.value)}
          onClick={(e) => e.stopPropagation()}
        />
      );
    }
    return (
      <span
        className={s.pieceButton}
        onClick={(e) => {
          if (!inSlot) return;
          e.stopPropagation();
          submit();
        }}
      >
        Verify
      </span>
    );
  };

  return (
    <div className={s.crash}>
      <div className={s.trace}>
        {STACK.map((line, i) => (
          <div key={i} className={i === 0 ? s.traceHead : undefined}>
            {line || " "}
          </div>
        ))}
      </div>

      <p className={s.instruction}>
        Component tree recovered. {loose.length} node{loose.length === 1 ? "" : "s"} unplaced.
      </p>

      {/* The slots. Proximity highlighting is just :hover here — a snap target
          that lights up when you are near it, which is the affordance the
          strewn pieces need to be findable at all. */}
      <div className={s.slots}>
        {SLOTS.map((want, i) => {
          const has = placed[i];
          return (
            <div
              key={i}
              className={`${s.slot} ${has ? s.slotFull : ""} ${held && !has ? s.slotOpen : ""}`}
              data-slot={i}
              data-holds={has ?? ""}
              onClick={() => (held ? put(held, i) : has ? pull(i) : undefined)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const piece = e.dataTransfer.getData("text/plain") as Piece;
                if (PIECES.includes(piece)) put(piece, i);
              }}
            >
              {has ? (
                <div
                  className={s.placed}
                  draggable
                  tabIndex={0}
                  data-piece={has}
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", has)}
                  onKeyDown={(e) => onPieceKey(e, has)}
                >
                  {renderPiece(has, true)}
                </div>
              ) : (
                <span className={s.slotHint}>slot {i + 1}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Everything the renderer left lying around, at the angles it left it. */}
      <div className={s.debris}>
        {loose.map((piece, i) => (
          <div
            key={piece}
            className={`${s.loose} ${held === piece ? s.looseHeld : ""}`}
            style={{ transform: `rotate(${(i % 2 ? 1 : -1) * (3 + i * 2)}deg)` }}
            draggable
            tabIndex={0}
            data-piece={piece}
            aria-label={PIECE_LABEL[piece]}
            onDragStart={(e) => e.dataTransfer.setData("text/plain", piece)}
            onClick={() => {
              setHeld((h) => (h === piece ? null : piece));
              sfx.blip();
            }}
            onKeyDown={(e) => onPieceKey(e, piece)}
          >
            {renderPiece(piece, false)}
            <span className={s.tagName}>{PIECE_LABEL[piece]}</span>
          </div>
        ))}
      </div>

      <div className={s.status} role="status">
        {assembled
          ? email.includes("@")
            ? "Tree resolved. Press Verify."
            : "Tree resolved. The field is empty."
          : "Place label, input and button in order."}
      </div>
    </div>
  );
}

export const L34: LevelModule = { meta, Component };
