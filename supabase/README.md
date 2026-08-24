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
