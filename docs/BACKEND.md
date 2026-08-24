# Backend

Supabase (Postgres + Edge Functions), consumed from Next.js route handlers.
The browser never writes to the database directly.

## 1. Schema

```sql
-- ─── runs ────────────────────────────────────────────────────────────────
create table runs (
  id            uuid primary key default gen_random_uuid(),
  handle        text,                    -- '@someone', null until submitted
  handle_norm   text generated always as (lower(ltrim(handle, '@'))) stored,
  score         integer not null default 0,
  levels_solved smallint not null default 0,
  levels_skipped smallint not null default 0,
  best_combo    numeric(3,1) not null default 1.0,
  killed_by     text,                    -- level slug the clock caught them on
  seed          text not null,           -- '8F2A1C-M'
  capability_profile text not null,      -- 'M','MA','MAC',''
  mercy_mode    boolean not null default false,
  duration_ms   integer not null,
  started_at    timestamptz not null,
  finished_at   timestamptz,
  status        text not null default 'open',  -- open | finished | rejected
  ip_hash       text not null,           -- sha256(ip + daily_salt), never raw
  ua_class      text,                    -- 'ios-safari','android-chrome',...
  created_at    timestamptz not null default now()
);

create index on runs (score desc) where status = 'finished';
create index on runs (handle_norm);
create index on runs (seed);

-- ─── run_events (append-only; the source of truth for scoring) ───────────
create table run_events (
  id        bigserial primary key,
  run_id    uuid not null references runs(id) on delete cascade,
  seq       integer not null,
  kind      text not null,               -- solve | fail | skip | enter
  level_id  text not null,
  at_ms     integer not null,            -- ms since run start, client-reported
  solve_ms  integer,
  path      text,                        -- which honest solve was used
  unique (run_id, seq)
);

-- ─── leaderboard (best finished run per handle) ──────────────────────────
create materialized view leaderboard as
select distinct on (handle_norm)
  handle_norm, handle, score, levels_solved, levels_skipped,
  killed_by, seed, mercy_mode, finished_at, id as run_id
from runs
where status = 'finished' and handle is not null
order by handle_norm, score desc, finished_at asc;

create unique index on leaderboard (handle_norm);
create index on leaderboard (score desc) where mercy_mode = false;
create index on leaderboard (score desc) where mercy_mode = true;

-- ─── community level submissions ─────────────────────────────────────────
create table level_submissions (
  id          uuid primary key default gen_random_uuid(),
  x_handle    text not null,
  handle_norm text generated always as (lower(ltrim(x_handle,'@'))) stored,
  title       text not null check (char_length(title) between 3 and 80),
  parodies    text not null check (char_length(parodies) between 3 and 120),
  mechanic    text not null check (char_length(mechanic) between 20 and 1200),
  inputs      text[] not null default '{}',
  status      text not null default 'pending',  -- pending|approved|shipped|rejected
  shipped_level_id text,                        -- 'L37' once built
  votes       integer not null default 0,
  ip_hash     text not null,
  created_at  timestamptz not null default now()
);

create index on level_submissions (status, votes desc);

create table submission_votes (
  submission_id uuid not null references level_submissions(id) on delete cascade,
  voter_hash    text not null,
  created_at    timestamptz not null default now(),
  primary key (submission_id, voter_hash)
);

-- ─── level stats (for balancing; see ARCHITECTURE §8) ────────────────────
create table level_stats (
  level_id    text primary key,
  attempts    bigint not null default 0,
  solves      bigint not null default 0,
  skips       bigint not null default 0,
  fails       bigint not null default 0,
  solve_ms_p50 integer,
  solve_ms_p90 integer,
  updated_at  timestamptz not null default now()
);
```

### Why an event log

The client's score is **advisory**. `run_events` is what the server scores
from. Without this, the top of the leaderboard is `2147483647` within a day of
launch and the game is over. See §4.

## 2. Row-level security

```sql
alter table runs             enable row level security;
alter table run_events       enable row level security;
alter table level_submissions enable row level security;
alter table submission_votes enable row level security;
```

- **No anon insert/update/delete on any table.** All writes go through Next.js
  route handlers using the service role key, server-side only.
- **Anon select on `leaderboard`** (the view) and on `level_submissions` where
  `status in ('approved','shipped')`. Nothing else is readable.
- `runs.ip_hash` and `run_events` are never exposed to the client.

## 3. API surface

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/run/start` | POST | Creates a `runs` row (`status='open'`), returns `{runId, runToken, seed, deck}`. `runToken` is an HMAC of `(runId, seed, startedAt)` with a server secret. |
| `/api/run/event` | POST | Appends a `run_events` row. Requires `runToken`. Idempotent on `(runId, seq)`. Batched — the client flushes every 5 events or 10s. |
| `/api/run/finish` | POST | Recomputes score from `run_events`, sets `status='finished'`, returns `{score, rank, percentile, neighbours}`. |
| `/api/run/claim` | POST | Attaches a `handle` to a finished run. Separate from finish so the handle screen can't block the leaderboard animation. |
| `/api/board` | GET | Paginated leaderboard. `?mercy=1` for the Mercy board, `?around=@handle` for the neighbourhood view. |
| `/api/lab/submit` | POST | Creates a `level_submissions` row. |
| `/api/lab/vote` | POST | Upserts a `submission_votes` row. |
| `/api/og` | GET | Dynamic share card image. See `VIRALITY.md`. |

## 4. Score validation

`/api/run/finish` recomputes using the **same pure `scoring.ts` module the
client uses**, run against `run_events`, and rejects the run if:

| Check | Rejection reason |
| --- | --- |
| `duration_ms > 5min + 15s grace` | `clock_overrun` |
| Any `solve_ms < 300ms` for a level with `parSeconds > 5` | `impossible_speed` |
| `count(solve) > 14` | `too_many_levels` — the theoretical max in 5 minutes |
| Events reference levels not in the seed's deck | `deck_mismatch` |
| `seq` gaps or duplicate `solve` for one level | `event_integrity` |
| Missing/invalid `runToken` | `unauthenticated` |
| >6 finished runs from one `ip_hash` in 10 min | `rate_limited` |

Rejected runs are stored with `status='rejected'` (not deleted) so we can look
at what people tried. Nothing about the rejection is surfaced to the client
beyond a generic *"Your score could not be verified. 🤖"* — which, given the
game, players will assume is another joke.

**Explicitly out of scope:** we are not building anti-cheat that survives a
determined attacker with devtools. The goal is that the leaderboard is
*plausible*, not that it is *provable*. Proportionality matters more than
paranoia here.

## 5. Privacy

- No accounts, no email, no cookies beyond a `sameSite=Lax` run token.
- IPs are hashed with a **daily-rotating salt**; the raw IP is never written.
- A typed `@handle` is public by definition and is presented as such
  (*"this will appear publicly on the leaderboard"* — the one piece of
  microcopy in the game that is completely straight).
- `/api/lab/submit` stores handle + text only. Submitted text is **never
  executed, never rendered as HTML, and never fed to a code generator**. It is
  a design brief that a human reads. This is the security boundary.
- A `/api/handle/remove?handle=` endpoint with a lightweight challenge exists
  from Phase 6 so anyone impersonated can get a row pulled without emailing us.

## 6. Migrations and environments

- Migrations live in `supabase/migrations/`, applied via the Supabase CLI in CI.
- Two projects: `ai-rush-dev` and `ai-rush-prod`. Preview deployments point at
  dev. `leaderboard` is refreshed by a `pg_cron` job every 30s in prod, on
  demand in dev.
- The service role key exists only as a Vercel environment variable on the
  server, never in `NEXT_PUBLIC_*`.
