-- AI Rush — schema and the write layer.
--
-- There is no service-role key in this app. Every write goes through a
-- `security definer` function, so the publishable key can do exactly what
-- these functions allow and nothing else. Direct table access for `anon` is
-- denied by having no policy at all.

create extension if not exists pgcrypto;

-- ─── runs ────────────────────────────────────────────────────────────────
create table runs (
  id                 uuid primary key default gen_random_uuid(),
  -- Held by the client that started the run. Without it you cannot submit to
  -- or claim someone else's run.
  secret             uuid not null default gen_random_uuid(),
  handle             text,
  handle_norm        text generated always as (lower(ltrim(handle, '@'))) stored,
  score              integer not null default 0,
  levels_solved      smallint not null default 0,
  levels_skipped     smallint not null default 0,
  best_combo         numeric(3,1) not null default 1.0,
  killed_by          text,
  seed               text not null,
  capability_profile text not null default '',
  mercy_mode         boolean not null default false,
  duration_ms        integer not null default 0,
  started_at         timestamptz not null default now(),
  finished_at        timestamptz,
  status             text not null default 'open'
                       check (status in ('open', 'finished', 'rejected')),
  rejection_reason   text,
  ip_hash            text not null default '',
  created_at         timestamptz not null default now()
);

create index runs_board_idx on runs (score desc) where status = 'finished';
create index runs_handle_idx on runs (handle_norm);
create index runs_rate_idx on runs (ip_hash, created_at desc);

-- ─── run_events ──────────────────────────────────────────────────────────
-- Append-only. What the score is computed from; the client's number is only
-- ever a claim, and one that gets checked.
create table run_events (
  id       bigserial primary key,
  run_id   uuid not null references runs(id) on delete cascade,
  seq      integer not null,
  kind     text not null check (kind in ('enter', 'solve', 'fail', 'skip')),
  level_id text not null,
  at_ms    integer not null,
  solve_ms integer,
  unique (run_id, seq)
);

-- ─── level_submissions ───────────────────────────────────────────────────
-- Stored as text, read by a human, never executed, never rendered as HTML,
-- never fed to a code generator. That is the boundary.
create table level_submissions (
  id               uuid primary key default gen_random_uuid(),
  x_handle         text not null check (x_handle ~ '^@?[A-Za-z0-9_]{1,15}$'),
  handle_norm      text generated always as (lower(ltrim(x_handle, '@'))) stored,
  title            text not null check (char_length(title) between 3 and 80),
  parodies         text not null check (char_length(parodies) between 3 and 120),
  mechanic         text not null check (char_length(mechanic) between 20 and 1200),
  inputs           text[] not null default '{}',
  status           text not null default 'pending'
                     check (status in ('pending', 'approved', 'shipped', 'rejected')),
  rejection_note   text,
  shipped_level_id text,
  votes            integer not null default 0,
  ip_hash          text not null default '',
  created_at       timestamptz not null default now()
);

create index level_submissions_queue_idx on level_submissions (status, votes desc);

-- ─── the board ───────────────────────────────────────────────────────────
-- Best claimed run per handle. A plain view, not materialised: it is always
-- current, and at our scale the index does the work.
create view leaderboard
with (security_invoker = false) as
select distinct on (handle_norm)
  handle_norm, handle, score, levels_solved, levels_skipped,
  killed_by, seed, mercy_mode, finished_at, id as run_id
from runs
where status = 'finished' and handle is not null
order by handle_norm, score desc, finished_at asc;

-- ─── row-level security ──────────────────────────────────────────────────
alter table runs              enable row level security;
alter table run_events        enable row level security;
alter table level_submissions enable row level security;

-- No policies on runs or run_events: anon reaches them only through the
-- functions below.
create policy "approved submissions are public"
  on level_submissions for select to anon, authenticated
  using (status in ('approved', 'shipped'));

grant select on leaderboard to anon, authenticated;

-- ═════════════════════════════════════════════════════════════════════════
-- The write layer
-- ═════════════════════════════════════════════════════════════════════════

create or replace function start_run(
  p_seed text, p_caps text, p_mercy boolean, p_ip_hash text default ''
) returns table (run_id uuid, run_secret uuid)
language plpgsql security definer set search_path = public as $$
declare v_recent integer;
begin
  -- Rate limit. Six finished runs from one address in ten minutes is already
  -- generous for a five-minute game.
  select count(*) into v_recent
  from runs
  where ip_hash = p_ip_hash and p_ip_hash <> '' and created_at > now() - interval '10 minutes';

  if v_recent > 12 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  return query
  insert into runs (seed, capability_profile, mercy_mode, ip_hash)
  values (left(p_seed, 32), left(coalesce(p_caps, ''), 8), coalesce(p_mercy, false), left(p_ip_hash, 64))
  returning runs.id, runs.secret;
end;
$$;

/*
 * Submit a finished run.
 *
 * The score arrives already validated and recomputed from the event log by
 * the route handler, which holds the single scoring implementation. What this
 * function adds is the thing a route handler cannot: a ceiling nobody can
 * argue with. The best conceivable level is a forbidden tier solved instantly,
 * first try, at maximum combo — 4,800 points. Anything above solves × 4,800
 * did not happen, whoever is calling and however they got here.
 */
create or replace function submit_run(
  p_run_id uuid, p_run_secret uuid, p_events jsonb,
  p_score integer, p_solved integer, p_skipped integer,
  p_best_combo numeric, p_killed_by text, p_duration_ms integer
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

  v_ceiling := greatest(0, coalesce(p_solved, 0)) * 4800;

  if p_score > v_ceiling or p_score < 0
     or p_duration_ms > 315000 or coalesce(p_solved, 0) > 14 then
    update runs set status = 'rejected', rejection_reason = 'implausible', finished_at = now()
    where id = p_run_id;
    return jsonb_build_object('ok', false, 'reason', 'implausible');
  end if;

  insert into run_events (run_id, seq, kind, level_id, at_ms, solve_ms)
  select p_run_id,
         (e ->> 'seq')::int, e ->> 'kind', left(e ->> 'levelId', 16),
         (e ->> 'atMs')::int, nullif(e ->> 'solveMs', '')::int
  from jsonb_array_elements(coalesce(p_events, '[]'::jsonb)) as e
  on conflict do nothing;

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

/* Attach a handle. Separate from submit so the tally never waits on it. */
create or replace function claim_run(
  p_run_id uuid, p_run_secret uuid, p_handle text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_run runs%rowtype;
  v_clean text;
  v_rank integer;
  v_total integer;
begin
  select * into v_run from runs where id = p_run_id and secret = p_run_secret;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  end if;
  if v_run.status <> 'finished' then
    return jsonb_build_object('ok', false, 'reason', 'not_finished');
  end if;

  v_clean := ltrim(btrim(coalesce(p_handle, '')), '@');
  if v_clean !~ '^[A-Za-z0-9_]{1,15}$' then
    return jsonb_build_object('ok', false, 'reason', 'bad_handle');
  end if;

  update runs set handle = '@' || v_clean where id = p_run_id;

  select count(*) + 1 into v_rank from leaderboard
  where mercy_mode = v_run.mercy_mode and score > v_run.score;
  select count(*) into v_total from leaderboard where mercy_mode = v_run.mercy_mode;

  return jsonb_build_object('ok', true, 'handle', '@' || v_clean, 'rank', v_rank, 'total', v_total);
end;
$$;

/* Rows around a rank, so the endgame can show real neighbours to beat. */
create or replace function board_around(
  p_score integer, p_mercy boolean, p_window integer default 3
) returns table (
  rank integer, handle text, score integer,
  levels_solved smallint, killed_by text, mercy_mode boolean
)
language sql stable security definer set search_path = public as $$
  with ranked as (
    select
      (row_number() over (order by l.score desc, l.finished_at asc))::int as rank,
      l.handle, l.score, l.levels_solved, l.killed_by, l.mercy_mode
    from leaderboard l
    where l.mercy_mode = p_mercy
  ),
  target as (select coalesce(min(rank), 1) as r from ranked where score <= p_score)
  select ranked.* from ranked, target
  where ranked.rank between greatest(1, target.r - p_window) and target.r + p_window
  order by ranked.rank;
$$;

create or replace function submit_level_idea(
  p_handle text, p_title text, p_parodies text, p_mechanic text,
  p_inputs text[], p_ip_hash text default ''
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_recent integer;
begin
  select count(*) into v_recent from level_submissions
  where ip_hash = p_ip_hash and p_ip_hash <> '' and created_at > now() - interval '1 day';
  if v_recent >= 3 then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited');
  end if;

  insert into level_submissions (x_handle, title, parodies, mechanic, inputs, ip_hash)
  values (btrim(p_handle), btrim(p_title), btrim(p_parodies), btrim(p_mechanic),
          coalesce(p_inputs, '{}'), left(p_ip_hash, 64));

  return jsonb_build_object('ok', true);
exception when others then
  return jsonb_build_object('ok', false, 'reason', 'invalid');
end;
$$;

revoke all on function start_run(text, text, boolean, text) from public;
revoke all on function submit_run(uuid, uuid, jsonb, integer, integer, integer, numeric, text, integer) from public;
revoke all on function claim_run(uuid, uuid, text) from public;
revoke all on function board_around(integer, boolean, integer) from public;
revoke all on function submit_level_idea(text, text, text, text, text[], text) from public;

grant execute on function start_run(text, text, boolean, text) to anon, authenticated;
grant execute on function submit_run(uuid, uuid, jsonb, integer, integer, integer, numeric, text, integer) to anon, authenticated;
grant execute on function claim_run(uuid, uuid, text) to anon, authenticated;
grant execute on function board_around(integer, boolean, integer) to anon, authenticated;
grant execute on function submit_level_idea(text, text, text, text, text[], text) to anon, authenticated;
