/*
 * Where people leave.
 *
 * ── The hole this fills ─────────────────────────────────────────────────
 *
 * `run_events` rows are written in exactly one place: inside `submit_run`.
 * So a run that is never submitted has no events at all — not one `enter` —
 * and the only thing recorded about it is that it started.
 *
 * Measured on the first day of real traffic: 38 runs started, 10 submitted,
 * and all 28 of the rest carried zero events. Three quarters of everyone who
 * has ever played this game left no trace of how far they got, and the schema
 * had no way for them to. That is the wrong blind spot for a project whose
 * whole growth loop runs through the endgame screen.
 *
 * ── Why this is a checkpoint and not a status ───────────────────────────
 *
 * The obvious shape is `status = 'abandoned'`, and it is wrong twice.
 *
 * The page hides on every tab switch, every app switch, every incoming call.
 * None of those is abandonment; most of those players come back. A run is not
 * abandoned at the moment we hear from it, it is abandoned if we never hear
 * from it again — which is a fact about the future and cannot be written now.
 *
 * And it would cost real players their scores. `submit_run` refuses anything
 * whose status is not 'open', so a player who alt-tabbed once at 0:30 and then
 * finished would submit into a closed run and never reach the board. A
 * telemetry feature that silently eats leaderboard entries is worse than no
 * telemetry.
 *
 * So the status is untouched and this records a timestamp. Three populations
 * come out of it, cleanly:
 *
 *   status = 'finished'                      played to the end
 *   status = 'open' and beacon_at is not null played, left mid-run — and the
 *                                             events say exactly where
 *   status = 'open' and beacon_at is null     never got far enough for the
 *                                             page to hide even once
 *
 * ── Cost ────────────────────────────────────────────────────────────────
 *
 * One row update and an append per beacon, and the append is a no-op after
 * the first because `(run_id, seq)` already carries a unique constraint. A
 * player who switches tabs twenty times writes twenty timestamps and twenty
 * conflicts, which is cheaper than the request that carried them.
 */

alter table runs add column if not exists beacon_at timestamptz;

-- The funnel query: open runs we heard from, newest first.
create index if not exists runs_beacon_idx on runs (beacon_at desc) where status = 'open';

/*
 * Record how far a run has got, without finishing it.
 *
 * Deliberately does not score. A score is a leaderboard fact and an
 * unfinished run has no business having one; what this is for is which level
 * the player was on and how long they lasted, both of which are in the
 * events. `submit_run` still owns every number that reaches the board.
 *
 * The counts are recomputed from the stored rows rather than taken from the
 * payload, so a beacon cannot claim a total its own events do not support.
 */
create or replace function beacon_run(
  p_run_id uuid, p_run_secret uuid, p_events jsonb, p_duration_ms integer
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_run runs%rowtype;
begin
  select * into v_run from runs where id = p_run_id and secret = p_run_secret;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  end if;

  /* A finished or rejected run is settled. A late beacon from a tab that was
     still open when the player submitted must not reopen anything. */
  if v_run.status <> 'open' then
    return jsonb_build_object('ok', false, 'reason', 'settled');
  end if;

  insert into run_events (run_id, seq, kind, level_id, at_ms, solve_ms)
  select p_run_id,
         (e ->> 'seq')::int, e ->> 'kind', left(e ->> 'levelId', 16),
         (e ->> 'atMs')::numeric::int, nullif(e ->> 'solveMs', '')::numeric::int
  from jsonb_array_elements(coalesce(p_events, '[]'::jsonb)) as e
  on conflict do nothing;

  update runs set
    beacon_at = now(),
    /* Monotonic: beacons can arrive out of order, and the furthest we ever
       saw them get is the honest number. */
    duration_ms = greatest(runs.duration_ms, least(coalesce(p_duration_ms, 0), 600000)),
    levels_solved  = (select count(*) from run_events
                       where run_events.run_id = p_run_id and kind = 'solve')::smallint,
    levels_skipped = (select count(*) from run_events
                       where run_events.run_id = p_run_id and kind = 'skip')::smallint
  where id = p_run_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function beacon_run(uuid, uuid, jsonb, integer) to anon, authenticated;

/*
 * ── Reading it ──────────────────────────────────────────────────────────
 *
 * The funnel:
 *
 *   select
 *     count(*) filter (where status = 'finished')                        as finished,
 *     count(*) filter (where status = 'open' and beacon_at is not null)  as left_midrun,
 *     count(*) filter (where status = 'open' and beacon_at is null)      as no_signal,
 *     count(*) filter (where handle is not null)                         as claimed
 *   from runs;
 *
 * Where they left — the level on screen when the last beacon fired, and how
 * long they stayed on it. This is the query the whole feature exists for:
 *
 *   select last.level_id,
 *          count(*)                                as left_here,
 *          round(avg(r.duration_ms - last.at_ms))  as avg_ms_enduring_it
 *   from runs r
 *   join lateral (
 *     select level_id, at_ms from run_events
 *     where run_id = r.id and kind = 'enter'
 *     order by seq desc limit 1
 *   ) last on true
 *   where r.status = 'open' and r.beacon_at is not null
 *   group by 1 order by 2 desc;
 */
