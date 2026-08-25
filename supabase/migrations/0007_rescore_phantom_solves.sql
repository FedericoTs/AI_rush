/*
 * Take back four solves nobody earned.
 *
 * ── What happened ───────────────────────────────────────────────────────
 *
 * `solve()` guarded against a repeated `onSolve()` with a check that could
 * never fire — it set `resolvedEntry` to the entry it was resolving and then
 * called `enterLevel`, which incremented `entries`, so the two were always one
 * apart and the guard was open forever. A second `onSolve()` therefore scored
 * **the next level in the deck**, instantly, for nothing. L18 · Drag To Unlock
 * sent that second call, because it tested its high-water mark against React
 * state that was stale for every pointermove in the same frame.
 *
 * Both are fixed in code. This is the wreckage: four of the first ten finished
 * runs, each with one free solve, each landing 0–1ms after a solve of L18.
 *
 *   15c887b7  @em                L20   2167 -> 1456
 *   c05462e3  @TFlows            L24   7816 -> 5269
 *   c522a3d6  @federico_sciuca   L27   7360 -> 5673
 *   dae26136  (no handle)        L04   3986 -> 3687
 *
 * ── Where the new numbers come from ─────────────────────────────────────
 *
 * Not arithmetic on the old ones. A phantom solve also incremented the combo
 * streak, so it inflated every solve that came after it as well — subtracting
 * its own points would leave the run still wrong.
 *
 * Each log was replayed through the same `scoreRun` and the same
 * deck-rebuilt-from-the-registry that `/api/run/finish` uses, with the phantom
 * event removed. As a check that the method was the same one that produced the
 * originals, every run was first replayed *unmodified* — all four reproduced
 * their stored score and solve count exactly. Only then were these written.
 *
 * ── Why the events go too, and why they are renumbered ──────────────────
 *
 * `asymmetry()` counts solves per level straight out of this table, so a
 * phantom left in place publishes on /arena that a human solved L20 in one
 * millisecond — L20 being the level in `impossible.ts` that no agent can even
 * attempt. A wrong number there is the most damaging thing this project can
 * put on a page, so the rows come out.
 *
 * Deleting one leaves a hole in `seq`, and a contiguous log from 1 is an
 * invariant the rest of the system assumes: the store writes
 * `seq: events.length + 1`, and `validateRun` rejects any log whose sequence
 * has a gap. A stored log that fails the project's own validity rule is a
 * landmine for the next person who writes an integrity check, so the tail is
 * shifted down. The two-step offset is to stop a row landing on a `seq` that
 * has not moved out of the way yet.
 *
 * The `enter` rows are deliberately kept. The deck really did advance — those
 * levels really were entered, for a millisecond — and an entry with no
 * resolution is the truthful record of a run that ended there.
 */

do $$
declare p record;
begin
  for p in
    select id, run_id, seq from (
      select id, run_id, seq, kind, level_id, solve_ms,
             lag(kind)      over w as prev_kind,
             lag(level_id)  over w as prev_level,
             lag(kind, 2)   over w as prev2_kind
      from run_events
      window w as (partition by run_id order by seq)
    ) c
    where kind = 'solve'
      and solve_ms < 300                 -- MIN_PLAUSIBLE_SOLVE_MS
      and prev_kind = 'enter'            -- its own entry, one event earlier
      and prev_level = level_id
      and prev2_kind = 'solve'           -- straight after another level's solve
    order by run_id, seq
  loop
    delete from run_events where id = p.id;
    /* Verified to be exactly one per run, which is what lets the snapshot's
       `seq` stay correct across the loop. */
    update run_events set seq = seq + 100000 where run_id = p.run_id and seq > p.seq;
    update run_events set seq = seq - 100001 where run_id = p.run_id and seq > 100000;
  end loop;
end $$;

update runs set score = 1456, levels_solved = 6  where id = '15c887b7-2019-4a19-814c-154accf922f4';
update runs set score = 5269, levels_solved = 8  where id = 'c05462e3-70b8-48a3-b6f6-87f74fc49a26';
update runs set score = 5673, levels_solved = 11 where id = 'c522a3d6-b49a-4907-9867-f3cf98843c50';
update runs set score = 3687, levels_solved = 7  where id = 'dae26136-0484-4768-8acd-4f83bbf894ed';
