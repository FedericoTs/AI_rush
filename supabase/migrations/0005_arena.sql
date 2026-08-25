/*
 * The Agent Arena: a second population, and the table that compares them.
 *
 * ── Why separate tables rather than a column on `runs` ───────────────────
 *
 * `AGENT_ARENA.md` §6 is unambiguous about the board:
 *
 *   > The agent board. Separate from the human board. Always. An agent scoring
 *   > above the human median would be a fun fact; an agent at the top of the
 *   > human board would kill the human board.
 *
 * A `runner` column would satisfy that with a `where` clause, and every future
 * query would be one forgotten `where` away from breaking the promise. Two
 * tables make it structural: `leaderboard` selects from `runs`, `runs` has no
 * agents in it, and there is no query anyone can write later that quietly
 * merges the two. A table you don't query cannot be forgotten.
 *
 * The same split is what makes the asymmetry table mean anything. Its human
 * column is `run_events`; if agents wrote there, the comparison would be
 * humans-plus-agents against agents, and the more agents played the more the
 * two columns would converge on each other for purely arithmetic reasons.
 *
 * ── What is recorded, and what deliberately is not ──────────────────────
 *
 * The outcome of each level: entered, solved, skipped, how long. Not one `why`
 * string. §8 promises an operator that reasoning is published only where they
 * were told it would be, and there is no spectator page yet — so the honest
 * thing is to store none of it. When the feed ships, that is a migration and a
 * notice, in that order.
 *
 * ── The vandalism this accepts ──────────────────────────────────────────
 *
 * The arena marker is set by the harness in a browser the operator controls,
 * so a person can set it too and file a human run as an agent. What that buys
 * them is removal from the human board plus a row on an aggregate — there is
 * no rank here to climb. It is graffiti, not an exploit, and the page shows
 * per-agent run counts so an unrecognised name with four runs reads as exactly
 * what it is. Stated here rather than papered over.
 */

-- ─── agent_runs ──────────────────────────────────────────────────────────
create table if not exists agent_runs (
  id             uuid primary key default gen_random_uuid(),
  -- Same bearer secret as a human run: without it you cannot submit to
  -- somebody else's.
  secret         uuid not null default gen_random_uuid(),
  -- Whatever the operator calls the thing they wired up. Not verified and not
  -- verifiable — it is a label on a sample, not an identity.
  agent          text not null check (agent ~ '^[A-Za-z0-9][A-Za-z0-9 ._/-]{0,39}$'),
  agent_norm     text generated always as (lower(btrim(agent))) stored,
  -- Whose harness it is. §7: "Operator pride" is a third of why anyone runs one.
  operator       text check (operator is null or operator ~ '^@?[A-Za-z0-9_]{1,15}$'),
  harness        text,
  score          integer not null default 0,
  levels_solved  smallint not null default 0,
  levels_skipped smallint not null default 0,
  killed_by      text,
  seed           text not null default '',
  duration_ms    integer not null default 0,
  started_at     timestamptz not null default now(),
  finished_at    timestamptz,
  status         text not null default 'open'
                   check (status in ('open', 'finished', 'rejected')),
  rejection_reason text,
  ip_hash        text not null default '',
  created_at     timestamptz not null default now()
);

create index if not exists agent_runs_agent_idx on agent_runs (agent_norm, score desc);
create index if not exists agent_runs_rate_idx on agent_runs (ip_hash, created_at desc);

-- ─── agent_events ────────────────────────────────────────────────────────
-- Deliberately the same shape as `run_events`, because the asymmetry table
-- runs the same aggregate over both and any difference between them would be
-- a difference in the comparison rather than in the players.
create table if not exists agent_events (
  id       bigserial primary key,
  run_id   uuid not null references agent_runs(id) on delete cascade,
  seq      integer not null,
  kind     text not null check (kind in ('enter', 'solve', 'fail', 'skip')),
  level_id text not null,
  at_ms    integer not null,
  solve_ms integer,
  unique (run_id, seq)
);

create index if not exists agent_events_level_idx on agent_events (level_id, kind);

alter table agent_runs   enable row level security;
alter table agent_events enable row level security;
-- No policies, as with `runs`: anon reaches these only through the functions
-- below.

-- ═════════════════════════════════════════════════════════════════════════
-- The write layer
-- ═════════════════════════════════════════════════════════════════════════

create or replace function start_agent_run(
  p_agent text, p_operator text, p_harness text,
  p_seed text, p_ip_hash text default ''
) returns table (run_id uuid, run_secret uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_agent text;
  v_operator text;
  v_recent integer;
begin
  v_agent := btrim(coalesce(p_agent, ''));
  if v_agent !~ '^[A-Za-z0-9][A-Za-z0-9 ._/-]{0,39}$' then
    -- Refused rather than coerced. A run filed under a scrubbed name would sit
    -- in the aggregate looking like data.
    raise exception 'bad_agent' using errcode = 'P0001';
  end if;

  v_operator := nullif(ltrim(btrim(coalesce(p_operator, '')), '@'), '');
  if v_operator is not null and v_operator !~ '^[A-Za-z0-9_]{1,15}$' then
    v_operator := null;
  end if;

  -- An agent harness can loop far faster than a person can play, so this cap
  -- is tighter than the human one and it is the only thing standing between a
  -- runaway script and a table full of one afternoon.
  select count(*) into v_recent
  from agent_runs
  where ip_hash = p_ip_hash and p_ip_hash <> '' and created_at > now() - interval '1 hour';

  if v_recent > 120 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  return query
  insert into agent_runs (agent, operator, harness, seed, ip_hash)
  values (
    left(v_agent, 40),
    case when v_operator is null then null else '@' || v_operator end,
    left(nullif(btrim(coalesce(p_harness, '')), ''), 40),
    left(coalesce(p_seed, ''), 32),
    left(coalesce(p_ip_hash, ''), 64)
  )
  returning agent_runs.id, agent_runs.secret;
end;
$$;

/*
 * Submit a finished agent run.
 *
 * Same shape and the same ceiling as `submit_run`, on purpose. The scoring is
 * done by the same route handler running the same pure functions over the same
 * event log — an agent is scored exactly as a human is, or the asymmetry table
 * is comparing two different games.
 */
create or replace function submit_agent_run(
  p_run_id uuid, p_run_secret uuid, p_events jsonb,
  p_score integer, p_solved integer, p_skipped integer,
  p_killed_by text, p_duration_ms integer, p_rejection text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_run agent_runs%rowtype;
  v_ceiling integer;
begin
  select * into v_run from agent_runs where id = p_run_id and secret = p_run_secret;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  end if;
  if v_run.status <> 'open' then
    return jsonb_build_object('ok', false, 'reason', 'already_finished');
  end if;

  insert into agent_events (run_id, seq, kind, level_id, at_ms, solve_ms)
  select p_run_id,
         (e ->> 'seq')::int, e ->> 'kind', left(e ->> 'levelId', 16),
         (e ->> 'atMs')::numeric::int, nullif(e ->> 'solveMs', '')::numeric::int
  from jsonb_array_elements(coalesce(p_events, '[]'::jsonb)) as e
  on conflict do nothing;

  if p_rejection is not null and p_rejection <> '' then
    update agent_runs set
      status = 'rejected', rejection_reason = left(p_rejection, 40),
      duration_ms = coalesce(p_duration_ms, 0), finished_at = now()
    where id = p_run_id;
    return jsonb_build_object('ok', false, 'reason', 'rejected');
  end if;

  v_ceiling := greatest(0, coalesce(p_solved, 0)) * 4800;
  if p_score > v_ceiling or p_score < 0 or p_duration_ms > 315000 then
    update agent_runs set status = 'rejected', rejection_reason = 'implausible',
      finished_at = now()
    where id = p_run_id;
    return jsonb_build_object('ok', false, 'reason', 'implausible');
  end if;

  update agent_runs set
    score = p_score,
    levels_solved = coalesce(p_solved, 0),
    levels_skipped = coalesce(p_skipped, 0),
    killed_by = left(p_killed_by, 120),
    duration_ms = coalesce(p_duration_ms, 0),
    status = 'finished',
    finished_at = now()
  where id = p_run_id;

  return jsonb_build_object('ok', true, 'score', p_score);
end;
$$;

-- ═════════════════════════════════════════════════════════════════════════
-- The asymmetry table
-- ═════════════════════════════════════════════════════════════════════════

/*
 * Per level, both populations, side by side.
 *
 *   > Which levels humans beat that agents can't, and the reverse. L11 will be
 *   > near-unbeatable for agents; L06 and L47 will fall to them instantly. This
 *   > table is the most genuinely interesting artifact the project produces,
 *   > and it improves every time either side gets better.
 *
 * A full outer join rather than a left one: a level only ever played by agents
 * belongs in the table as much as one only ever played by humans, and it is the
 * silicon tier's future home. Levels neither side has entered are absent, which
 * is the honest rendering of no data — a row of zeroes reads as a level nobody
 * can solve.
 *
 * Rates are not computed here. `seen` and `solved` are the facts; a percentage
 * over four attempts is a number that looks like evidence, and the page is the
 * right place to decide when to draw it.
 */
create or replace function asymmetry(p_min_seen integer default 1)
returns table (
  level_id        text,
  human_seen      integer,
  human_solved    integer,
  human_skipped   integer,
  human_median_ms integer,
  agent_seen      integer,
  agent_solved    integer,
  agent_skipped   integer,
  agent_median_ms integer
)
language sql stable security definer set search_path = public as $$
  with h as (
    select
      e.level_id,
      count(*) filter (where e.kind = 'enter')::int as seen,
      count(*) filter (where e.kind = 'solve')::int as solved,
      count(*) filter (where e.kind = 'skip')::int  as skipped,
      (percentile_cont(0.5) within group (order by e.solve_ms)
        filter (where e.kind = 'solve'))::int       as median_ms
    from run_events e
    join runs r on r.id = e.run_id
    where r.status = 'finished'
    group by e.level_id
  ),
  a as (
    select
      e.level_id,
      count(*) filter (where e.kind = 'enter')::int as seen,
      count(*) filter (where e.kind = 'solve')::int as solved,
      count(*) filter (where e.kind = 'skip')::int  as skipped,
      (percentile_cont(0.5) within group (order by e.solve_ms)
        filter (where e.kind = 'solve'))::int       as median_ms
    from agent_events e
    join agent_runs r on r.id = e.run_id
    where r.status = 'finished'
    group by e.level_id
  )
  select
    coalesce(h.level_id, a.level_id) as level_id,
    coalesce(h.seen, 0), coalesce(h.solved, 0), coalesce(h.skipped, 0), h.median_ms,
    coalesce(a.seen, 0), coalesce(a.solved, 0), coalesce(a.skipped, 0), a.median_ms
  from h full outer join a on a.level_id = h.level_id
  where coalesce(h.seen, 0) + coalesce(a.seen, 0) >= greatest(1, coalesce(p_min_seen, 1))
  order by 1;
$$;

/*
 * Who has actually played.
 *
 * The table above is an aggregate, and an aggregate with no provenance invites
 * you to read four runs as a finding. This is the denominator, rendered next to
 * it: which agents, how many runs each, best score.
 */
create or replace function arena_agents()
returns table (
  agent text, operator text, runs integer, best_score integer, last_seen timestamptz
)
language sql stable security definer set search_path = public as $$
  select
    -- The most recent spelling of a name that normalises the same way.
    (array_agg(r.agent order by r.finished_at desc))[1] as agent,
    (array_agg(r.operator order by r.finished_at desc))[1] as operator,
    count(*)::int as runs,
    max(r.score)::int as best_score,
    max(r.finished_at) as last_seen
  from agent_runs r
  where r.status = 'finished'
  group by r.agent_norm
  order by count(*) desc, max(r.finished_at) desc
  limit 50;
$$;

revoke all on function start_agent_run(text, text, text, text, text) from public;
grant execute on function start_agent_run(text, text, text, text, text) to anon, authenticated;

revoke all on function submit_agent_run(uuid, uuid, jsonb, integer, integer, integer, text, integer, text) from public;
grant execute on function submit_agent_run(uuid, uuid, jsonb, integer, integer, integer, text, integer, text) to anon, authenticated;

grant execute on function asymmetry(integer) to anon, authenticated;
grant execute on function arena_agents() to anon, authenticated;
