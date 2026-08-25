/**
 * Levels an agent cannot play, and why.
 *
 * Not levels that are hard. Levels that need an input the tool surface does
 * not have, where no sequence of `click`, `type`, `key`, `drag`, `scroll` or
 * `wait` can reach a winning state. There is a real difference between those
 * two things and the whole value of the asymmetry table depends on keeping it:
 *
 *   > Which levels humans beat that agents can't, and the reverse. This table
 *   > is the most genuinely interesting artifact the project produces.
 *
 * A level nobody can attempt is not evidence about agents. Left unmarked it
 * files a 0% solve rate that reads exactly like a finding, and the more runs
 * accumulate the more authoritative that wrong number looks. So it is declared
 * here, once, with the reason a person can check.
 *
 * ── The bar for adding one ───────────────────────────────────────────────
 *
 * A verified missing verb, not a suspicion. `npm run arena:sweep` reports a
 * level with no playable region at all; someone then reads the level and
 * confirms what it needs. "The agent kept failing it" is not sufficient — six
 * runs failed L05 before the sixth found the tab that solves it, and every one
 * of those failures was ours, not the level's.
 *
 * ── What is deliberately not here ────────────────────────────────────────
 *
 * **L11 · Choose A Secure Password.** A runner game timed against obstacles an
 * agent cannot see moving. `AGENT_ARENA.md` §4 calls it "near-impossible, and
 * the flailing is the show", and near-impossible is a legitimate cell in the
 * table — a rate near zero that a lucky run could dent is a finding, and the
 * transcripts it produces are the best content in the mode. It stays in.
 */

export interface Unplayable {
  levelId: string;
  /** The verb that does not exist. Checked by a person, not inferred. */
  needs: string;
}

export const UNPLAYABLE: readonly Unplayable[] = [
  {
    levelId: "L20",
    /*
     * "Confirm you're nearby". With sensors declined — which is what an agent
     * always is — it asks for a held left click, a right click and a held
     * space bar, all three at once, for three seconds.
     *
     * `click` presses and releases in one call, `key` presses one key once,
     * and there is no right button anywhere in the surface. Three simultaneous
     * sustained inputs cannot be expressed at all, in any order, ever.
     *
     * Adding `press` / `release` / `rightClick` would fix it and is the wrong
     * trade: this level's difficulty is manual dexterity, three new verbs
     * would exist for one screen, and every one of them is a new way for the
     * other forty-eight to behave differently for an agent than for a person.
     */
    needs: "three simultaneous held inputs, and a right mouse button",
  },
];

const IDS = new Set(UNPLAYABLE.map((u) => u.levelId));

export function isUnplayable(levelId: string): boolean {
  return IDS.has(levelId);
}

export function reasonFor(levelId: string): string | null {
  return UNPLAYABLE.find((u) => u.levelId === levelId)?.needs ?? null;
}
