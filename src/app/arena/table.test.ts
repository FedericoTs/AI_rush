import { describe, expect, it } from "vitest";
import { buildTable, hasComparison, MIN_SEEN, percent, seconds, unattemptable } from "./table";
import { CATALOG } from "@/levels/catalog";
import type { AsymmetryRow } from "@/lib/db";

const L = CATALOG.map((m) => m.id);

function row(over: Partial<AsymmetryRow> & { level_id: string }): AsymmetryRow {
  return {
    human_seen: 0, human_solved: 0, human_skipped: 0, human_median_ms: null,
    agent_seen: 0, agent_solved: 0, agent_skipped: 0, agent_median_ms: null,
    ...over,
  };
}

describe("the bar below which nothing is drawn", () => {
  it("shows no rate at all under the minimum", () => {
    const [r] = buildTable([
      row({ level_id: L[0]!, human_seen: MIN_SEEN - 1, human_solved: 1 }),
    ]);
    expect(r!.human.rate).toBeNull();
    /* Because a rate is what the reader believes. The counts are still there
       and the page prints them as a fraction instead. */
    expect(r!.human.solved).toBe(1);
    expect(percent(r!.human.rate)).toBe("—");
  });

  it("shows one at the minimum exactly", () => {
    const [r] = buildTable([row({ level_id: L[0]!, human_seen: MIN_SEEN, human_solved: 1 })]);
    expect(r!.human.rate).toBeCloseTo(1 / MIN_SEEN);
  });

  it("refuses a gap when only one side cleared the bar", () => {
    /* The failure this exists to prevent: 90% against a blank column reads as
       "agents cannot do this", when what happened is that no agent tried. */
    const [r] = buildTable([
      row({ level_id: L[0]!, human_seen: 400, human_solved: 360, agent_seen: 2, agent_solved: 0 }),
    ]);
    expect(r!.human.rate).toBeCloseTo(0.9);
    expect(r!.agent.rate).toBeNull();
    expect(r!.gap).toBeNull();
  });

  it("computes one when both sides did", () => {
    const [r] = buildTable([
      row({ level_id: L[0]!, human_seen: 100, human_solved: 80, agent_seen: 10, agent_solved: 1 }),
    ]);
    expect(r!.gap).toBeCloseTo(0.7);
  });
});

describe("ordering", () => {
  it("puts the biggest disagreement first, in either direction", () => {
    const rows = [
      /* Humans slightly ahead. */
      row({ level_id: L[0]!, human_seen: 50, human_solved: 30, agent_seen: 50, agent_solved: 25 }),
      /* Agents far ahead — the interesting direction, and it must not be
         sorted below a smaller human-favouring gap by a stray sign. */
      row({ level_id: L[1]!, human_seen: 50, human_solved: 10, agent_seen: 50, agent_solved: 45 }),
      /* No comparison at all. */
      row({ level_id: L[2]!, human_seen: 900, human_solved: 400 }),
    ];
    expect(buildTable(rows).map((r) => r.levelId)).toEqual([L[1], L[0], L[2]]);
  });

  it("falls back to catalogue order once there is nothing to compare", () => {
    const rows = [
      row({ level_id: L[4]!, human_seen: 3, human_solved: 1 }),
      row({ level_id: L[1]!, human_seen: 3, human_solved: 1 }),
      row({ level_id: L[3]!, human_seen: 3, human_solved: 1 }),
    ];
    expect(buildTable(rows).map((r) => r.levelId)).toEqual([L[1], L[3], L[4]]);
  });
});

describe("what it declines to show", () => {
  it("drops a level id that is no longer in the catalogue", () => {
    /* A renamed or removed level's history is not attributable to anything a
       reader could go and play, so it is not a row. */
    expect(buildTable([row({ level_id: "L99", human_seen: 400, human_solved: 4 })])).toEqual([]);
  });

  it("knows when nothing on the table is a comparison yet", () => {
    const none = buildTable([row({ level_id: L[0]!, human_seen: 400, human_solved: 40 })]);
    expect(hasComparison(none)).toBe(false);

    const some = buildTable([
      row({ level_id: L[0]!, human_seen: 40, human_solved: 4, agent_seen: 40, agent_solved: 1 }),
    ]);
    expect(hasComparison(some)).toBe(true);
  });
});

describe("formatting", () => {
  it("keeps a tenth of a second on fast solves and drops it on slow ones", () => {
    expect(seconds(2400)).toBe("2.4s");
    expect(seconds(41_600)).toBe("42s");
    expect(seconds(null)).toBe("—");
  });
});

/**
 * Levels no agent can attempt.
 *
 * The sweep found one: L20 wants a held left click, a right click and a held
 * space bar at once, and the tool surface cannot express any of that. It is
 * not a hard level for an agent, it is a level with no legal move.
 *
 * The danger is entirely in what a comparison row would look like. A real
 * human rate beside a nought reads as a finding about agents, and every run
 * that piles on makes the wrong number look more authoritative. So it comes
 * out of the table and is shown on its own, with the reason.
 */
describe("a level with no legal move", () => {
  it("never appears as a comparison", () => {
    const table = buildTable([
      row({ level_id: "L20", human_seen: 400, human_solved: 240, agent_seen: 40, agent_solved: 0 }),
      row({ level_id: L[0]!, human_seen: 40, human_solved: 20, agent_seen: 40, agent_solved: 10 }),
    ]);
    expect(table.map((r) => r.levelId)).not.toContain("L20");
    /* And the level beside it is untouched — this removes a row, it does not
       quietly change the arithmetic of the others. */
    expect(table[0]!.gap).toBeCloseTo(0.25);
  });

  it("is listed on its own, with the human number kept", () => {
    const [only] = unattemptable([
      row({ level_id: "L20", human_seen: 400, human_solved: 240 }),
    ]);
    expect(only!.levelId).toBe("L20");
    expect(only!.human.rate).toBeCloseTo(0.6);
    expect(only!.needs).toMatch(/held|right/);
  });

  it("is listed even when nobody at all has played it", () => {
    /* A table with a hole in it invites the reader to assume the hole is
       uninteresting. The list is the whole point, so it does not depend on
       there being data. */
    const [only] = unattemptable([]);
    expect(only!.levelId).toBe("L20");
    expect(only!.human.seen).toBe(0);
    expect(only!.human.rate).toBeNull();
  });
});
