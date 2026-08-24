# Supabase

Migrations are applied with the Supabase CLI. **No projects have been
provisioned** — creating them costs money and attaches billing to an account,
so that is a call for a human to make.

## When you're ready

```bash
supabase projects create ai-rush-dev
supabase projects create ai-rush-prod
supabase link --project-ref <ref>
supabase db push
```

Two projects, because preview deployments must not write to the production
leaderboard.

## Environment

| Variable | Where | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | Safe to expose. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | Reads the leaderboard view and approved submissions. Nothing else — RLS denies the rest by having no policy. |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | Never prefixed `NEXT_PUBLIC_`. Every write goes through a route handler holding this. |
| `RUN_TOKEN_SECRET` | server only | HMAC key for run tokens (Phase 3). |
| `IP_HASH_SALT` | server only | Rotated daily. Raw IPs are never written. |

## Production notes

- `leaderboard` is a materialized view; refresh it every 30s with `pg_cron`.
- `runs.ip_hash` and `run_events` are never exposed to the client.
- Rejected runs are kept with `status = 'rejected'` rather than deleted — it is
  worth seeing what people tried.

## Live

The `ai-rush` project (`zamiayilppjufozhuxev`, eu-central-1) is provisioned and
migrated. Free tier, $0/month.

**There is no service-role key in this app.** Every write goes through a
`security definer` function, so the publishable key can do exactly five things
and nothing else:

| Function | What it allows |
| --- | --- |
| `start_run` | Open a run. Returns its id and a per-run secret. |
| `submit_run` | Finish a run you hold the secret for, once, under a score ceiling. |
| `claim_run` | Attach an `@handle` to a run you hold the secret for. |
| `board_around` | Read ranks near a score. |
| `submit_level_idea` | File a level idea, three per address per day. |

No table is directly readable or writable by `anon`; the only direct grant is
`select` on the `leaderboard` view. That is why the publishable key can be a
committed default in `src/lib/db.ts` — env vars still override it.

### Known limit

An anonymous leaderboard can be stuffed by anyone willing to script the API and
submit plausible event logs. The score ceiling stops fabricated numbers, but not
volume. If that happens, the fix is the one the plan already anticipates: X
OAuth for verified handles, or a challenge before `claim_run`.


## Is the leaderboard permanent?

The data itself: yes. `runs`, `run_events` and `level_submissions` are ordinary
logged Postgres tables (`relpersistence = 'p'`), not unlogged or temporary, so
rows survive restarts and redeploys. **The application contains no delete,
truncate or drop path of any kind** — the only `on delete` in the schema is the
cascade from `runs` to `run_events`. Nothing a player does can remove a row,
and neither can the app.

Two real risks, neither of them in the code:

### The project pauses when nobody plays

Supabase pauses a free-tier project after roughly a week of inactivity. Data is
retained and comes back on restore, but until someone notices and clicks a
button the leaderboard is simply gone — the kind of outage that starts quietly
and is found late. Two other projects in this org are already `INACTIVE`, so
this is not hypothetical.

`/api/keepalive` runs daily at 06:00 UTC (`vercel.json`) and reads one row,
which is enough to prevent it. Real traffic makes it redundant; it exists for
the quiet weeks, which are exactly when nobody is watching.

### There are no backups on the free plan

No point-in-time recovery, no automated daily dumps. A mistake against the
production database is not undoable. Before running anything destructive by
hand, take a dump:

```bash
supabase db dump --project-ref zamiayilppjufozhuxev -f backup.sql
```

Upgrading the org to Pro ($25/month) removes both risks: no pausing, and daily
backups with seven-day PITR. Worth doing the day the board has scores on it
that people would be upset to lose.

## Tests never touch production

The baked-in credentials in `src/lib/db.ts` apply **only when `VERCEL=1`**. On
a laptop or in CI there is no database unless the variables are set on purpose,
and the leaderboard tests skip themselves rather than writing rows.

This was not theoretical: end-to-end runs had put eight `@e2e_*` handles onto
the live board before the guard existed. A real player's leaderboard should
never be somebody's test fixture.
