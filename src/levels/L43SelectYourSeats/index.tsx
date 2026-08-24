"use client";

import { useMemo, useState } from "react";
import type { LevelModule, LevelProps } from "@/engine/types";
import { meta } from "./meta";
import { CouplingGraph, type ControlState } from "@/engine/coupling/graph";
import { SlopBadge, SlopCard, SlopCta, SlopError, SlopFooter, SlopHeading, SlopHint, SlopMicrocopy } from "@/ui/slop/Slop";
import { FOOTER_LINKS, slopSubhead } from "@/ui/slop/phrases";
import s from "./styles.module.css";

const ROWS = 6;
const COLS = 4;
const SEATS = ROWS * COLS;
const LETTERS = ["A", "B", "C", "D"] as const;

/** Passenger ids, in boarding order. */
const IDS = ["p1", "p2", "p3"] as const;
const TARGET: ControlState = { p1: 5, p2: 10, p3: 18 };

export const seatName = (i: number) => `${Math.floor(i / COLS) + 1}${LETTERS[i % COLS]}`;
/** Directly behind. Wraps at the back of the cabin, because of course it does. */
export const behind = (i: number) => (i + COLS) % SEATS;

/**
 * The chain that runs backwards through everyone already seated.
 *
 * Seating passenger 2 relocates passenger 1 to the seat directly behind
 * whatever you just picked; seating 3 does the same to 2. So each placement
 * only disturbs passengers placed *before* it, and the honest solve is reverse
 * order — 3, then 2, then 1 — where every move is final.
 *
 * Same theorem as L37 in a different costume, and by this point in a run a
 * player may have seen one of these already. That transfer is real and earned,
 * which is why the family is worth twelve levels rather than one.
 *
 * The relocation is a `propagate` edge with ratio 1: passenger n's seat index
 * moves to `pick + COLS`, and the graph carries that down the chain. The seat
 * controls wrap, which is what makes "behind" well defined in the back row.
 */
function Component({ onSolve, onFail, rng, sfx }: LevelProps) {
  const graph = useMemo(
    () =>
      new CouplingGraph(
        IDS.map((id) => ({ id, min: 0, max: SEATS - 1, wrap: true })),
        [
          { from: "p3", to: "p2", kind: "propagate", ratio: 1 },
          { from: "p2", to: "p1", kind: "propagate", ratio: 1 },
        ],
      ),
    [],
  );

  const [seats, setSeats] = useState<ControlState>(() => {
    /* Somewhere plausible and wrong, drawn from the seed. */
    const taken = new Set<number>();
    const pick = () => {
      let n = rng.int(SEATS);
      while (taken.has(n)) n = (n + 1) % SEATS;
      taken.add(n);
      return n;
    };
    const start = { p1: pick(), p2: pick(), p3: pick() };
    return IDS.every((id) => start[id] === TARGET[id]) ? { ...start, p1: (start.p1 + 3) % SEATS } : start;
  });

  const [selected, setSelected] = useState<(typeof IDS)[number]>("p3");
  const [error, setError] = useState<string | null>(null);
  const [sub] = useState(() => slopSubhead(rng));

  const occupant = (i: number) => IDS.find((id) => seats[id] === i) ?? null;

  const place = (seat: number) => {
    setSeats((prev) => {
      /* `set` moves the chosen passenger to this seat and cascades the delta
         to everyone before them — which lands each of them exactly one row
         back, because the whole chain shifts by the same amount. */
      const moved = graph.set(prev, selected, seat);
      /* The relocation is "directly behind the seat you just picked", not
         "wherever the delta happened to put you". Re-seat the tail explicitly
         so the rule the player is told is the rule they get. */
      const order = IDS.slice(0, IDS.indexOf(selected)).reverse();
      let at = seat;
      const out: Record<string, number> = { ...moved, [selected]: seat };
      for (const id of order) {
        at = behind(at);
        out[id] = at;
      }
      return out;
    });
    setError(null);
    sfx.click();
  };

  const confirm = () => {
    if (IDS.every((id) => seats[id] === TARGET[id])) {
      onSolve();
      return;
    }
    setError("That arrangement could not be seated. We've added a row. ✈️");
    onFail("wrong-seats");
    sfx.fail();
  };

  return (
    <SlopCard>
      <SlopBadge>Booking · Trusted by Teams</SlopBadge>
      <SlopHeading>Select Your Seats ✈️</SlopHeading>
      <SlopMicrocopy>{sub}</SlopMicrocopy>

      <div className={s.who}>
        {IDS.map((id, i) => (
          <button
            key={id}
            type="button"
            className={`${s.tab} ${selected === id ? s.tabOn : ""} ${seats[id] === TARGET[id] ? s.tabOk : ""}`}
            onClick={() => setSelected(id)}
            data-testid={`passenger-${i + 1}`}
            aria-pressed={selected === id}
          >
            Passenger {i + 1}
            <i>{seatName(seats[id]!)} → {seatName(TARGET[id]!)}</i>
          </button>
        ))}
      </div>

      <div className={s.cabin} data-testid="cabin">
        {Array.from({ length: SEATS }, (_, i) => {
          const who = occupant(i);
          const wanted = IDS.find((id) => TARGET[id] === i);
          return (
            <button
              key={i}
              type="button"
              className={`${s.seat} ${who ? s.taken : ""} ${wanted ? s.wanted : ""}`}
              onClick={() => place(i)}
              data-testid={`seat-${i}`}
              aria-label={`Seat ${seatName(i)}${who ? `, passenger ${IDS.indexOf(who) + 1}` : ""}`}
            >
              {who ? IDS.indexOf(who) + 1 : seatName(i)}
            </button>
          );
        })}
      </div>

      <SlopCta onClick={confirm}>Confirm Seats</SlopCta>
      <SlopError>{error}</SlopError>
      <SlopHint>
        Seating is optimised automatically to keep your party together. 🤝
      </SlopHint>
      <SlopFooter links={FOOTER_LINKS} />
    </SlopCard>
  );
}

export const L43: LevelModule = { meta, Component };
