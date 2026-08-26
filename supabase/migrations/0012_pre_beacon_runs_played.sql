/*
 * Count the runs that predate the beacon as played.
 *
 * `0011` narrowed "runs played" to `finished or beacon_at is not null`, which
 * is the right rule and produced a wrong number: 14 out of 45. Not because
 * 31 people bounced, but because 38 of those 45 runs were started before the
 * beacon existed, and a run from before the beacon *cannot* satisfy the rule.
 * Applying a rule retroactively to data collected under no rule doesn't make
 * the count stricter, it makes it false — it silently reclassifies every run
 * from the first two days as a bounce.
 *
 * So the rule now applies from the moment the evidence started existing, and
 * everything before it is counted. The cutoff is the beacon's own ship time:
 *
 *   c6a1c22  2026-08-25 12:36:01 +0000
 *   "Record how far a run got, even when it is never submitted"
 *
 * That is a fact somebody can check with `git log`, which is the whole reason
 * it is a written constant and not `(select min(beacon_at) from runs)`. A
 * derived cutoff moves when the earliest beaconed run is deleted, and a
 * cumulative counter that walks backwards is the bug `0010` already fixed.
 *
 * The commit is a lower bound on the deploy — a run in the gap between commit
 * and deploy would be counted as played on this rule while being just as
 * unknowable as the ones before it, which is the same treatment. Right now the
 * gap contains exactly one run and it is `finished`, so it counts either way.
 *
 * ── What this is honest about ───────────────────────────────────────────
 *
 * The 38 historical runs include bounces. We know that and we cannot tell
 * which. The trade is between over-counting a known-size prehistory and
 * under-counting it by 100%, and the first is the smaller lie: the count is
 * approximate before 2026-08-25 and exact after it, and it only ever grows on
 * evidence from here.
 *
 * On today's data: 45 started, 42 played, 3 post-beacon runs that opened the
 * page and never came back. Those three stay out — that is the rule working.
 *
 * The JSON key does not change, so this needs no coordination with a deploy.
 */
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
    /* Reached the end, or left mid-run and told us — or predates the beacon
       that would have let it tell us. Cumulative, never a window. */
    'runs', (
      select count(*) from runs
      where status = 'finished'
         or beacon_at is not null
         or created_at < timestamptz '2026-08-25 12:36:01+00'
    ),
    'players', (select count(*) from leaderboard where mercy_mode = false),
    'topScore', (
      select coalesce(max(score), 0) from leaderboard where mercy_mode = false
    )
  );
$$;

grant execute on function live_stats() to anon, authenticated;
