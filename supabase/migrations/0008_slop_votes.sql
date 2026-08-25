/*
 * Slop Score — a ten-second way in.
 *
 * The run is five minutes, and five minutes is a brutal floor: 38 runs became
 * 10 finishes became 3 names on the board. Nobody has anything to post until
 * they have played the whole thing. This is the short version — look at one
 * interface, say whether you think a real product shipped it, find out what
 * everyone else said.
 *
 * ── What the number means ───────────────────────────────────────────────
 *
 * The share of people who believe a real product would actually ship the
 * level. Not "how sloppy is it" — every level in the catalogue is maximum
 * slop by construction and they share a design system, so that question has
 * one answer forty-nine times. Plausibility is what varies, and it is also
 * where the joke is: the uncomfortable levels are the ones people believe.
 *
 * ── Why the average is not stored ───────────────────────────────────────
 *
 * This table keeps votes. The published score is computed in `src/slop/score.ts`
 * from a count and a sum, because it blends in a prior derived from the
 * level's tier — and tier lives in the catalogue, which is TypeScript. Putting
 * half that formula in SQL would mean two places to change it and one of them
 * would be wrong within a month.
 *
 * ── Voting twice ────────────────────────────────────────────────────────
 *
 * A daily-rotating `ip_hash` is a weak identity and it is the only one this
 * project has — it stores no raw addresses, by design. So one vote per hash
 * per level per day is the rule, and the honest description of it is "an
 * obstacle", not "a guarantee". What it protects is small: this decides no
 * rank and pays nothing. Somebody determined to move a number can move it,
 * and the vote count is displayed beside the score so a number resting on
 * four votes says so.
 */

create table if not exists slop_votes (
  id         uuid primary key default gen_random_uuid(),
  level_id   text not null check (level_id ~ '^L[0-9]{2}$'),
  score      smallint not null check (score between 0 and 100),
  ip_hash    text not null default '',
  voted_on   date not null default (now() at time zone 'utc')::date,
  created_at timestamptz not null default now()
);

/* One vote per level per hash per day. The hash rotates daily anyway, so the
   date is belt and braces against a clock that disagrees. */
create unique index if not exists slop_votes_once_idx
  on slop_votes (level_id, ip_hash, voted_on) where ip_hash <> '';

create index if not exists slop_votes_level_idx on slop_votes (level_id);

alter table slop_votes enable row level security;
-- No policy. Reached only through the function below.

/*
 * Record a vote and report what everybody else said.
 *
 * The count and sum are taken **before** the insert, deliberately. Being
 * scored against an average you have just moved is not a test of anything,
 * and with a handful of votes on a level your own would dominate it.
 */
create or replace function vote_slop(
  p_level_id text, p_score integer, p_ip_hash text default ''
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_votes integer;
  v_total bigint;
  v_recent integer;
begin
  if p_score is null or p_score < 0 or p_score > 100 then
    return jsonb_build_object('ok', false, 'reason', 'out_of_range');
  end if;

  /* A runaway-script backstop, set far above what a person voting on five
     levels produces. Not an anti-abuse measure; see the note at the top. */
  select count(*) into v_recent from slop_votes
  where ip_hash = p_ip_hash and p_ip_hash <> '' and created_at > now() - interval '10 minutes';
  if v_recent > 200 then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited');
  end if;

  select count(*), coalesce(sum(score), 0) into v_votes, v_total
  from slop_votes where level_id = p_level_id;

  insert into slop_votes (level_id, score, ip_hash)
  values (p_level_id, p_score, left(coalesce(p_ip_hash, ''), 64))
  on conflict do nothing;

  return jsonb_build_object('ok', true, 'votes', v_votes, 'total', v_total);
end;
$$;

/* Every level's raw tally, for a gallery and for anybody checking the maths. */
create or replace function slop_tallies()
returns table (level_id text, votes bigint, total bigint)
language sql security definer set search_path = public stable as $$
  select level_id, count(*), coalesce(sum(score), 0) from slop_votes group by level_id;
$$;

grant execute on function vote_slop(text, integer, text) to anon, authenticated;
grant execute on function slop_tallies() to anon, authenticated;
