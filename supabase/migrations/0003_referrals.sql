/*
 * Share-to-unlock, and why it cannot be usefully cheated.
 *
 * ── The thing we refused to build ────────────────────────────────────────
 *
 * The obvious design is "paste the URL of your post and we will check it".
 * That does not work and could not be made to work: X's API is gated, scraping
 * is blocked, and even with perfect access a verification is a snapshot of a
 * post that can be deleted a second later. It would be a checkbox wearing a
 * costume.
 *
 * The second-obvious design is "somebody else opened your link". Closer, but
 * every post on X is fetched immediately by X's own link-preview crawler, so
 * every share would unlock itself before a human saw it.
 *
 * ── What is actually counted ─────────────────────────────────────────────
 *
 * A credit is earned when a person who arrived through your link **finishes a
 * real run**: opened server-side, scored server-side from the event log, and
 * worth more than nothing. A preview crawler fetches HTML; it does not start a
 * run, play a level and post a validated event log.
 *
 * And the exploit is the product. To manufacture one credit you need a
 * different network and five minutes of actually playing the game. That is not
 * a hole to be plugged — it is the behaviour the whole feature exists to
 * cause. A system whose cheapest attack is "play the game properly" does not
 * need to detect fraud, because there is nothing to gain by committing it.
 *
 * The rest is belt and braces:
 *   - one credit per distinct visitor, ever (the primary key)
 *   - the visitor's daily IP hash must differ from the sharer's
 *   - the run must be `finished` with a server-computed score above zero
 *
 * That last check is the load-bearing one. The others are cheap.
 *
 * ── And why none of it needs to be airtight ──────────────────────────────
 *
 * Unlocked levels are worth exactly what their tier is worth. They are new
 * content, never an advantage, and the leaderboard cannot tell whether a run
 * contained one. Nobody gains anything by forging a credit, which is the real
 * reason this is safe — not the checks above.
 */

create table if not exists referrals (
  key           text primary key,
  handle        text not null,
  handle_norm   text not null,
  owner_ip_hash text not null default '',
  created_at    timestamptz not null default now()
);

create index if not exists referrals_handle_idx on referrals (handle_norm);

create table if not exists referral_credits (
  key             text not null references referrals(key) on delete cascade,
  visitor_ip_hash text not null,
  run_id          uuid not null references runs(id) on delete cascade,
  created_at      timestamptz not null default now(),
  -- One person, one credit, forever. Not per day, not per run.
  primary key (key, visitor_ip_hash)
);

create index if not exists referral_credits_run_idx on referral_credits (run_id);

alter table referrals        enable row level security;
alter table referral_credits enable row level security;
-- No policies: anon reaches both only through the functions below.

/*
 * Mint (or return) the key for a claimed handle.
 *
 * Called at claim time, when a player puts their name on a run. Keys are
 * bearer secrets: holding one is what proves you own the credits, because
 * handles here are typed rather than verified and cannot own anything.
 *
 * Stable per handle, so a player who claims twice keeps one key and one set of
 * unlocks rather than silently starting again.
 */
create or replace function referral_key(
  p_handle text, p_ip_hash text default ''
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_clean text;
  v_norm  text;
  v_key   text;
begin
  v_clean := ltrim(btrim(coalesce(p_handle, '')), '@');
  if v_clean !~ '^[A-Za-z0-9_]{1,15}$' then
    return jsonb_build_object('ok', false, 'reason', 'bad_handle');
  end if;
  v_norm := lower(v_clean);

  select key into v_key from referrals where handle_norm = v_norm;

  if v_key is null then
    -- 32 hex characters — 128 bits — from `gen_random_uuid`, which is built
    -- into Postgres and needs no extension. `gen_random_bytes` would have been
    -- shorter and does not exist here: pgcrypto is not installed, and because
    -- the claim route swallows a mint failure to protect the score, that would
    -- have failed invisibly and simply never handed anybody an unlock.
    v_key := replace(gen_random_uuid()::text, '-', '');

    insert into referrals (key, handle, handle_norm, owner_ip_hash)
    values (v_key, '@' || v_clean, v_norm, left(coalesce(p_ip_hash, ''), 64))
    on conflict (handle_norm) do nothing;

    select key into v_key from referrals where handle_norm = v_norm;
  end if;

  return jsonb_build_object('ok', true, 'key', v_key);
end;
$$;

create unique index if not exists referrals_handle_norm_key on referrals (handle_norm);

/*
 * Credit a referral, if the arrival was real.
 *
 * Called from /api/run/finish once the run has already been stored, so the
 * `finished` + `score > 0` test below is a test of a number this database
 * computed, never one the client sent.
 */
create or replace function credit_referral(
  p_key text, p_run_id uuid, p_ip_hash text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_owner_ip text;
  v_score    integer;
  v_status   text;
begin
  select owner_ip_hash into v_owner_ip from referrals where key = p_key;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown_key');
  end if;

  select score, status into v_score, v_status from runs where id = p_run_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_run');
  end if;

  -- The load-bearing check. A link-preview crawler never gets here: it would
  -- have to open a run, play it, and submit an event log that survives
  -- validation and rescoring.
  if v_status <> 'finished' or coalesce(v_score, 0) <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'not_a_real_run');
  end if;

  -- Best effort, and known to be: the IP salt rotates daily, so this stops
  -- recognising the sharer's own device after midnight UTC. It is cheap and it
  -- catches the lazy case; the real deterrent is that faking this costs a
  -- five-minute run.
  if p_ip_hash <> '' and p_ip_hash = v_owner_ip then
    return jsonb_build_object('ok', false, 'reason', 'self');
  end if;

  insert into referral_credits (key, visitor_ip_hash, run_id)
  values (p_key, left(coalesce(p_ip_hash, ''), 64), p_run_id)
  on conflict (key, visitor_ip_hash) do nothing;

  return jsonb_build_object('ok', true, 'credits', referral_credits_count(p_key));
end;
$$;

create or replace function referral_credits_count(p_key text) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from referral_credits where key = p_key;
$$;

/* What the holder of a key is allowed to know: their own number. */
create or replace function referral_status(p_key text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_handle text;
begin
  select handle into v_handle from referrals where key = p_key;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown_key');
  end if;
  return jsonb_build_object(
    'ok', true, 'handle', v_handle, 'credits', referral_credits_count(p_key)
  );
end;
$$;

revoke all on function referral_key(text, text) from public;
revoke all on function credit_referral(text, uuid, text) from public;
revoke all on function referral_status(text) from public;
revoke all on function referral_credits_count(text) from public;

grant execute on function referral_key(text, text) to anon, authenticated;
grant execute on function credit_referral(text, uuid, text) to anon, authenticated;
grant execute on function referral_status(text) to anon, authenticated;
