/*
 * The front page counter, and two functions that were never in this repo.
 *
 * ── The counter ─────────────────────────────────────────────────────────
 *
 * `live_stats` reported `runsToday` as a rolling twenty-four hours of
 * *finished* runs. Two things wrong with that, compounding:
 *
 *   - it is a window, so every run falls out of it a day later and the number
 *     walks back to zero on its own
 *   - it counted only finished runs, and roughly three quarters of runs are
 *     abandoned — so even on a busy day it read about a quarter of the truth
 *
 * The result is a counter whose entire job is to say the place is alive,
 * sitting on the landing page reporting that it is not. "0 runs today" is the
 * first number a stranger reads, and on a young game it is the wrong one to
 * lead with, not because it flatters — because it decays regardless of how
 * much has been played.
 *
 * Now it is every run ever started. A run row exists from the moment somebody
 * opens the play page, so this counts attempts rather than completions, which
 * is what "runs played" means and is the number that only ever goes up.
 * Liveness is already covered honestly by `playingNow` beside it.
 *
 * The old `runsToday` key is gone. `liveStats()` in the app accepts either and
 * coerces every field, because the app and the database are deployed by
 * different mechanisms minutes apart — and a missing key there used to mean
 * `undefined.toLocaleString()` and a blank front page.
 *
 * ── The two functions ───────────────────────────────────────────────────
 *
 * `live_stats` and `board_top` existed in the production database and in no
 * migration. Every other function this app calls is declared in this
 * directory; these two were applied by hand and never written down, so the
 * migrations did not reproduce production and a fresh environment would have
 * come up with a landing page and a leaderboard that both threw.
 *
 * That is the same shape as the CI workflow that had never run: something
 * load-bearing, working fine, and unrecorded. `board_top` is reproduced below
 * exactly as it exists — no behaviour change, only a home.
 */

-- ─── board_top ───────────────────────────────────────────────────────────
-- Verbatim from production. Declared here for the first time.
create or replace function board_top(p_mercy boolean, p_limit integer default 50)
returns table (
  rank integer, handle text, score integer, levels_solved smallint,
  killed_by text, seed text, finished_at timestamptz
)
language sql security definer set search_path = public stable as $$
  select
    (row_number() over (order by l.score desc, l.finished_at asc))::int,
    l.handle, l.score, l.levels_solved, l.killed_by, l.seed, l.finished_at
  from leaderboard l
  where l.mercy_mode = p_mercy
  order by l.score desc, l.finished_at asc
  limit greatest(1, least(100, p_limit));
$$;

-- ─── live_stats ──────────────────────────────────────────────────────────
create or replace function live_stats()
returns jsonb
language sql security definer set search_path = public stable as $$
  select jsonb_build_object(
    /* Open runs from the last six minutes. A run is five minutes long, so
       that window is either somebody mid-run or somebody who walked away
       seconds ago — and it never inflates the way a session count would. */
    'playingNow', (
      select count(*) from runs
      where status = 'open' and created_at > now() - interval '6 minutes'
    ),
    /* Every run ever started. Cumulative, monotonic, and not a window. */
    'runs', (select count(*) from runs),
    'players', (select count(*) from leaderboard where mercy_mode = false),
    'topScore', (
      select coalesce(max(score), 0) from leaderboard where mercy_mode = false
    )
  );
$$;

grant execute on function board_top(boolean, integer) to anon, authenticated;
grant execute on function live_stats() to anon, authenticated;
