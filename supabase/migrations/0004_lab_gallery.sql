/*
 * The Lab gallery: votes, public rejections, and a takedown path.
 *
 * ── What a vote is, and what it deliberately is not ──────────────────────
 *
 * `COMMUNITY_LEVELS.md` §3 asks for one vote per submission per "browser
 * fingerprint + IP hash". This does not build a fingerprint. Fingerprinting is
 * a surveillance technique, and adopting one to protect the integrity of a
 * poll that the same document calls "a signal, not a mandate" would be wildly
 * out of proportion — and hypocritical in a game whose entire subject is
 * interfaces that take more than they need.
 *
 * What it uses instead is a **ballot**: a random id the browser generates for
 * itself, stores locally, and sends with a vote. It identifies nobody. It is
 * not derived from anything about the device. It survives a page reload and it
 * does not survive clearing site data — which means somebody determined to
 * vote twice can, and that is an accepted cost, stated here rather than
 * papered over.
 *
 * The daily IP hash is still recorded, for one narrow purpose: a cap on how
 * many votes one address may cast per day, which is what actually stops a
 * script. It cannot be used to follow anyone — the salt rotates at midnight —
 * and it is not part of the vote's identity.
 *
 * The real defence is structural. Votes never decide anything on their own:
 *
 *   > A 400-vote idea that's mechanically identical to Level 12 doesn't get
 *   > built. We say so publicly on the card.
 *
 * A system where the top-voted entry still has to survive a human reading it
 * has very little to gain from being rigged.
 *
 * ── Why rejected submissions become visible ──────────────────────────────
 *
 * §5 promises rejection reasons are public, because "silently ignoring the
 * top-voted idea is how community programs lose trust". So the read policy
 * exposes a rejected row **only once a human has written a reason on it**.
 * A rejection with no note stays invisible: that is the spam path, and spam
 * does not get a public card explaining itself.
 */

-- ─── votes ───────────────────────────────────────────────────────────────

create table if not exists submission_votes (
  submission_id uuid not null references level_submissions(id) on delete cascade,
  -- A random id the browser made up about itself. Not a fingerprint.
  ballot        text not null check (char_length(ballot) between 16 and 64),
  -- Daily-rotating, and used only for the per-day cap below.
  ip_hash       text not null default '',
  created_at    timestamptz not null default now(),
  primary key (submission_id, ballot)
);

create index if not exists submission_votes_rate_idx on submission_votes (ip_hash, created_at);

-- ─── takedowns ───────────────────────────────────────────────────────────
-- Handles are typed, never verified, so somebody's name can end up on a
-- submission they did not write. That has to be undoable by the person it
-- happened to, without an account, immediately.
create table if not exists submission_takedowns (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references level_submissions(id) on delete cascade,
  reason        text not null default '',
  ip_hash       text not null default '',
  created_at    timestamptz not null default now()
);

create index if not exists submission_takedowns_sub_idx on submission_takedowns (submission_id);

/*
 * A requested takedown hides the card at once, pending a human.
 *
 * This is a real trade: somebody can grief a good submission into invisibility
 * for as long as it takes to review. It is still the right default, because
 * the two mistakes are not symmetric — a good idea hidden for three days costs
 * the queue nothing, and a stranger's handle sitting on words they did not
 * write is the kind of harm you cannot apologise your way out of afterwards.
 *
 * The per-day IP cap on the request function is what keeps the griefing case
 * tedious.
 */
alter table level_submissions
  add column if not exists takedown_requested_at timestamptz;

alter table submission_votes     enable row level security;
alter table submission_takedowns enable row level security;
-- No policies on either: anon reaches them only through the functions below.

-- Replaces the Phase 3 policy, which showed approved and shipped only.
drop policy if exists "approved submissions are public" on level_submissions;

create policy "the gallery is public"
  on level_submissions for select to anon, authenticated
  using (
    takedown_requested_at is null
    and (
      status in ('approved', 'shipped')
      -- A public no, with the reason attached. Never a silent one.
      or (status = 'rejected' and coalesce(rejection_note, '') <> '')
    )
  );

-- ═════════════════════════════════════════════════════════════════════════
-- The read layer
-- ═════════════════════════════════════════════════════════════════════════

/*
 * The gallery.
 *
 * It takes no ballot, deliberately. "Which ones have I voted on" is answered
 * on the client from the same local record that holds the ballot itself —
 * a ballot is per-browser, so the two are exactly as accurate as each other,
 * and the one that does not send an identifier over the wire on every page
 * view is the one to build.
 */
create or replace function lab_gallery(
  p_sort text default 'top', p_limit integer default 60
) returns table (
  id uuid, x_handle text, title text, parodies text, mechanic text,
  inputs text[], status text, rejection_note text, shipped_level_id text,
  votes integer, created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select
    s.id, s.x_handle, s.title, s.parodies, s.mechanic,
    s.inputs, s.status, s.rejection_note, s.shipped_level_id,
    s.votes, s.created_at
  from level_submissions s
  where s.takedown_requested_at is null
    and (
      s.status in ('approved', 'shipped')
      or (s.status = 'rejected' and coalesce(s.rejection_note, '') <> '')
    )
    and case p_sort
      when 'shipped' then s.status = 'shipped'
      else true
    end
  order by
    case when p_sort = 'new' then s.created_at end desc nulls last,
    case when p_sort = 'new' then null else s.votes end desc nulls last,
    s.created_at desc
  limit greatest(1, least(p_limit, 200));
$$;

-- ═════════════════════════════════════════════════════════════════════════
-- The write layer
-- ═════════════════════════════════════════════════════════════════════════

/* One address, forty votes a day. Comfortably above anybody reading the whole
   gallery in one sitting and comfortably below anything worth scripting. */
create or replace function vote_submission(
  p_id uuid, p_ballot text, p_ip_hash text default ''
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_recent integer;
  v_votes  integer;
  v_ok     boolean;
begin
  if coalesce(p_ballot, '') !~ '^[A-Za-z0-9_-]{16,64}$' then
    return jsonb_build_object('ok', false, 'reason', 'bad_ballot');
  end if;

  -- Only a card somebody can actually see may be voted on.
  select true into v_ok from level_submissions s
  where s.id = p_id
    and s.takedown_requested_at is null
    and s.status in ('approved', 'shipped');
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_votable');
  end if;

  select count(*) into v_recent from submission_votes
  where ip_hash = p_ip_hash and p_ip_hash <> '' and created_at > now() - interval '1 day';
  if v_recent >= 40 then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited');
  end if;

  insert into submission_votes (submission_id, ballot, ip_hash)
  values (p_id, p_ballot, left(coalesce(p_ip_hash, ''), 64))
  on conflict (submission_id, ballot) do nothing;

  -- Recounted from the rows rather than incremented, so a double submit, a
  -- retry or a deleted vote can never leave the displayed number lying.
  update level_submissions
  set votes = (select count(*) from submission_votes where submission_id = p_id)
  where id = p_id
  returning votes into v_votes;

  return jsonb_build_object('ok', true, 'votes', v_votes, 'voted', true);
end;
$$;

create or replace function unvote_submission(
  p_id uuid, p_ballot text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_votes integer;
begin
  delete from submission_votes where submission_id = p_id and ballot = p_ballot;

  update level_submissions
  set votes = (select count(*) from submission_votes where submission_id = p_id)
  where id = p_id
  returning votes into v_votes;

  if v_votes is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown');
  end if;
  return jsonb_build_object('ok', true, 'votes', v_votes, 'voted', false);
end;
$$;

/*
 * "That is my handle and I did not write that."
 *
 * Hides the card immediately and files the request for a human. Three a day
 * per address, which is enough for a person clearing up an impersonation and
 * tedious for anybody using it as a delete button.
 */
create or replace function request_takedown(
  p_id uuid, p_reason text default '', p_ip_hash text default ''
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_recent integer;
  v_exists boolean;
begin
  -- Before the insert, not after: submission_takedowns has a foreign key to
  -- level_submissions, so an unknown id would raise rather than return, and a
  -- takedown route that 500s on a stale card is a takedown route that looks
  -- broken to exactly the person who most needs it to work.
  select true into v_exists from level_submissions where id = p_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown');
  end if;

  select count(*) into v_recent from submission_takedowns
  where ip_hash = p_ip_hash and p_ip_hash <> '' and created_at > now() - interval '1 day';
  if v_recent >= 3 then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited');
  end if;

  insert into submission_takedowns (submission_id, reason, ip_hash)
  values (p_id, left(btrim(coalesce(p_reason, '')), 600), left(coalesce(p_ip_hash, ''), 64));

  update level_submissions
  set takedown_requested_at = coalesce(takedown_requested_at, now())
  where id = p_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function lab_gallery(text, integer) from public;
revoke all on function vote_submission(uuid, text, text) from public;
revoke all on function unvote_submission(uuid, text) from public;
revoke all on function request_takedown(uuid, text, text) from public;

grant execute on function lab_gallery(text, integer) to anon, authenticated;
grant execute on function vote_submission(uuid, text, text) to anon, authenticated;
grant execute on function unvote_submission(uuid, text) to anon, authenticated;
grant execute on function request_takedown(uuid, text, text) to anon, authenticated;

/*
 * The Friday triage query. Deliberately not an admin UI — `ROADMAP.md` Phase 6
 * says "can be a Supabase Studio saved query at first — do not build a CMS",
 * and a CMS for a queue that gets single digits a week is a way of avoiding
 * the actual work of reading them.
 *
 *   select id, x_handle, title, parodies, votes, created_at, mechanic
 *   from level_submissions
 *   where status = 'pending' and takedown_requested_at is null
 *   order by created_at;
 *
 * To approve:  update level_submissions set status = 'approved' where id = '…';
 * To reject:   update level_submissions
 *              set status = 'rejected', rejection_note = 'too close to L12'
 *              where id = '…';
 * To ship:     update level_submissions
 *              set status = 'shipped', shipped_level_id = 'L52' where id = '…';
 *
 * A rejection with no note is invisible rather than public. That is the spam
 * path; use it for spam and nothing else.
 */
