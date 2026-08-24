/*
 * A rejected run must not look like a run someone was bad at.
 *
 * The route handler validates the event log before submitting, and until now a
 * log that failed validation was submitted anyway — with zeros in every field.
 * `submit_run` had no way to be told that, so it wrote status = 'finished',
 * score = 0, rejection_reason = null, and the row went onto the board as a
 * legitimate nought. That is how a real twelve-level run came to be published
 * as a score of zero with nothing anywhere recording why.
 *
 * Two things change. The function can now be told the reason, in which case it
 * files the run as rejected — which the leaderboard view already excludes —
 * and keeps the events for diagnosis. And the reason is stored, so the next
 * time this happens it is a query rather than an investigation.
 *
 * The parameter is added rather than defaulted onto the existing signature:
 * a default would leave two overloads and make every nine-argument call
 * ambiguous, so the old one goes first.
 */

drop function if exists submit_run(uuid, uuid, jsonb, integer, integer, integer, numeric, text, integer);

create function submit_run(
  p_run_id uuid, p_run_secret uuid, p_events jsonb,
  p_score integer, p_solved integer, p_skipped integer,
  p_best_combo numeric, p_killed_by text, p_duration_ms integer,
  p_rejection text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_run runs%rowtype;
  v_ceiling integer;
  v_rank integer;
  v_total integer;
begin
  select * into v_run from runs where id = p_run_id and secret = p_run_secret;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  end if;
  if v_run.status <> 'open' then
    return jsonb_build_object('ok', false, 'reason', 'already_finished');
  end if;

  -- The events are stored either way. A rejected log is the only evidence of
  -- why it was rejected, and throwing it away is how a bug like this one
  -- survives a second time.
  insert into run_events (run_id, seq, kind, level_id, at_ms, solve_ms)
  select p_run_id,
         (e ->> 'seq')::int, e ->> 'kind', left(e ->> 'levelId', 16),
         -- via numeric: a client that sends fractional milliseconds should not
         -- lose its whole run to a cast error.
         (e ->> 'atMs')::numeric::int, nullif(e ->> 'solveMs', '')::numeric::int
  from jsonb_array_elements(coalesce(p_events, '[]'::jsonb)) as e
  on conflict do nothing;

  -- Rejected by the route handler's validation, with a named reason.
  if p_rejection is not null and p_rejection <> '' then
    update runs set
      status = 'rejected', rejection_reason = left(p_rejection, 40),
      duration_ms = coalesce(p_duration_ms, 0), finished_at = now()
    where id = p_run_id;
    return jsonb_build_object('ok', false, 'reason', left(p_rejection, 40));
  end if;

  -- The ceiling nobody can argue with. The best conceivable level is a
  -- forbidden tier solved instantly, first try, at maximum combo — 4,800
  -- points. Anything above solves × 4,800 did not happen, whoever is calling.
  v_ceiling := greatest(0, coalesce(p_solved, 0)) * 4800;

  if p_score > v_ceiling or p_score < 0
     or p_duration_ms > 315000 or coalesce(p_solved, 0) > 14 then
    update runs set status = 'rejected', rejection_reason = 'implausible', finished_at = now()
    where id = p_run_id;
    return jsonb_build_object('ok', false, 'reason', 'implausible');
  end if;

  update runs set
    score = p_score,
    levels_solved = coalesce(p_solved, 0),
    levels_skipped = coalesce(p_skipped, 0),
    best_combo = coalesce(p_best_combo, 1.0),
    killed_by = left(p_killed_by, 120),
    duration_ms = coalesce(p_duration_ms, 0),
    status = 'finished',
    finished_at = now()
  where id = p_run_id;

  select count(*) + 1 into v_rank from leaderboard
  where mercy_mode = v_run.mercy_mode and score > p_score;
  select count(*) into v_total from leaderboard where mercy_mode = v_run.mercy_mode;

  return jsonb_build_object('ok', true, 'score', p_score, 'rank', v_rank, 'total', v_total);
end;
$$;

revoke all on function submit_run(uuid, uuid, jsonb, integer, integer, integer, numeric, text, integer, text) from public;
grant execute on function submit_run(uuid, uuid, jsonb, integer, integer, integer, numeric, text, integer, text) to anon, authenticated;
