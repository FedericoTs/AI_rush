-- AI Rush — initial schema.
--
-- Nothing here is reachable from the browser. Every write goes through a
-- Next.js route handler with the service role key; the anon key can read the
-- leaderboard view and approved submissions, and nothing else.

create extension if not exists pgcrypto;

-- ─── runs ────────────────────────────────────────────────────────────────
create table runs (
  id                 uuid primary key default gen_random_uuid(),
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
  ip_hash            text not null,
  ua_class           text,
  created_at         timestamptz not null default now()
);

create index runs_score_idx on runs (score desc) where status = 'finished';
create index runs_handle_idx on runs (handle_norm);
create index runs_seed_idx on runs (seed);

-- ─── run_events ──────────────────────────────────────────────────────────
-- Append-only, and the only thing the score is ever computed from. Without
-- this the top of the leaderboard reads 2147483647 within a day of launch.
create table run_events (
  id       bigserial primary key,
  run_id   uuid not null references runs(id) on delete cascade,
  seq      integer not null,
  kind     text not null check (kind in ('enter', 'solve', 'fail', 'skip')),
  level_id text not null,
  at_ms    integer not null,
  solve_ms integer,
  path     text,
  unique (run_id, seq)
);

create index run_events_run_idx on run_events (run_id, seq);

-- ─── leaderboard ─────────────────────────────────────────────────────────
-- Best finished run per handle. Refreshed by pg_cron every 30s in production.
create materialized view leaderboard as
select distinct on (handle_norm)
  handle_norm, handle, score, levels_solved, levels_skipped,
  killed_by, seed, mercy_mode, finished_at, id as run_id
from runs
where status = 'finished' and handle is not null
order by handle_norm, score desc, finished_at asc;

create unique index leaderboard_handle_idx on leaderboard (handle_norm);
create index leaderboard_open_idx on leaderboard (score desc) where mercy_mode = false;
create index leaderboard_mercy_idx on leaderboard (score desc) where mercy_mode = true;

-- ─── level_submissions ───────────────────────────────────────────────────
-- Player-designed levels. Stored as text, read by a human, and never executed,
-- never rendered as HTML, never fed to a code generator. That is the boundary.
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
  ip_hash          text not null,
  created_at       timestamptz not null default now()
);

create index level_submissions_queue_idx on level_submissions (status, votes desc);

create table submission_votes (
  submission_id uuid not null references level_submissions(id) on delete cascade,
  voter_hash    text not null,
  created_at    timestamptz not null default now(),
  primary key (submission_id, voter_hash)
);

-- ─── level_stats ─────────────────────────────────────────────────────────
-- Feeds the weekly balance review: anything skipped over 60% is unreadable
-- rather than hard; anything solved first-try under 5s is free points.
create table level_stats (
  level_id     text primary key,
  attempts     bigint not null default 0,
  solves       bigint not null default 0,
  skips        bigint not null default 0,
  fails        bigint not null default 0,
  solve_ms_p50 integer,
  solve_ms_p90 integer,
  updated_at   timestamptz not null default now()
);

-- ─── row-level security ──────────────────────────────────────────────────
alter table runs              enable row level security;
alter table run_events        enable row level security;
alter table level_submissions enable row level security;
alter table submission_votes  enable row level security;
alter table level_stats       enable row level security;

-- No anon policies on runs, run_events or submission_votes: no policy means
-- no access. Writes happen server-side with the service role key only.

create policy "approved submissions are public"
  on level_submissions for select
  to anon
  using (status in ('approved', 'shipped'));

create policy "level stats are public"
  on level_stats for select
  to anon
  using (true);

grant select on leaderboard to anon;
