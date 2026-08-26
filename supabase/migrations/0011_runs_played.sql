/*
 * "Runs played" should mean somebody played it.
 *
 * `0010` made the counter cumulative, which fixed a number that walked back
 * to zero overnight. It counted every run ever started, and a run row exists
 * from the moment the play page opens — so it also counted the bounce, the
 * link-preview that got far enough, and the tab closed after four seconds.
 *
 * Now it counts the runs we can actually see somebody played: the ones that
 * reached the end, plus the ones that left mid-run and said so on the way out.
 * `beacon_at` is exactly that evidence and it exists for no other reason.
 *
 * ── The caveat, which is real and permanent ─────────────────────────────
 *
 * The beacon shipped today. Before it, an abandoned run left no trace at all
 * — that gap is why it was built — so a run played for four minutes yesterday
 * and closed at the last level is indistinguishable from a bounce, forever.
 * There is no repair for that: the evidence was never recorded.
 *
 * At the moment of writing that is 45 runs started, 14 of them provably
 * played, and 31 unknowable — almost all from before the beacon existed. So
 * this counter under-reports history by design, and grows accurately from
 * here. Preferred over the alternative, which was over-reporting it by
 * counting arrivals as plays.
 *
 * The JSON key does not change, so this needs no coordination with a deploy:
 * `toLiveStats` reads `runs` either way.
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
    /* Reached the end, or left mid-run and told us. Cumulative, and never a
       window — see the header for what it cannot know about. */
    'runs', (
      select count(*) from runs
      where status = 'finished' or beacon_at is not null
    ),
    'players', (select count(*) from leaderboard where mercy_mode = false),
    'topScore', (
      select coalesce(max(score), 0) from leaderboard where mercy_mode = false
    )
  );
$$;

grant execute on function live_stats() to anon, authenticated;
