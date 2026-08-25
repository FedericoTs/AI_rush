/*
 * The top of the funnel, first-party.
 *
 * Everything downstream of a visit is already recorded: `runs` says who
 * started, `beacon_at` says how far they got, `slop_votes` says who took the
 * ten-second door. The one number missing is how many people arrived at all,
 * and where from — which is the only way to tell whether a post worked.
 *
 * Vercel's Web Analytics is the obvious answer and is now a paid feature. The
 * other obvious answer is a third-party script, and that one is wrong for this
 * project rather than merely expensive: the footer promises "no account, no
 * email, nothing to install", the schema has never stored a raw IP, and a game
 * where one canvas level's frame rate had to be fixed does not want another
 * vendor's JavaScript on every page.
 *
 * So it is thirty lines here and a beacon on the client, using machinery that
 * already exists.
 *
 * ── What is deliberately not collected ──────────────────────────────────
 *
 * No cookie, no localStorage, no device or browser fingerprint, no user agent,
 * no raw address. The only identifier is the same daily-rotating salted hash
 * the rest of the schema uses, which makes "how many people" answerable within
 * a day and deliberately unanswerable across days.
 *
 * The path is folded onto the fixed set of routes that exist and the referrer
 * is reduced to a bare hostname before either reaches this table — see
 * `src/visits/paths.ts`. A referrer URL carries the linking page's path and
 * query, which on a social site is somebody's post; the hostname answers the
 * whole question and is all that is kept.
 *
 * ── Why the client records it, not the server ───────────────────────────
 *
 * A server-side count includes every crawler, link-preview fetch and
 * prefetch, and a launch is exactly when those spike. The beacon runs after
 * hydration, so a row means a real browser executed JavaScript. That
 * undercounts people with scripts off, and undercounting honestly beats
 * counting a link preview as a visitor.
 */

create table if not exists page_views (
  id         bigserial primary key,
  /* Already normalised to a known route by the caller; the check is a
     backstop against a future caller that forgets. */
  path       text not null check (char_length(path) <= 40),
  /* Null for a direct visit, an internal navigation, or an unparseable one. */
  ref_host   text check (ref_host is null or char_length(ref_host) <= 80),
  /* True for the first view after a full page load — the arrival. Later
     views in the same session are navigation, and counting them as arrivals
     would attribute every internal click to whoever linked here. */
  entry      boolean not null default false,
  ip_hash    text not null default '',
  viewed_on  date not null default (now() at time zone 'utc')::date,
  created_at timestamptz not null default now()
);

create index if not exists page_views_day_idx on page_views (viewed_on, path);
create index if not exists page_views_ref_idx on page_views (ref_host) where entry;
create index if not exists page_views_rate_idx on page_views (ip_hash, created_at desc);

alter table page_views enable row level security;
-- No policy. Reached only through the function below.

create or replace function record_view(
  p_path text, p_ref_host text default null, p_entry boolean default false,
  p_ip_hash text default ''
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_recent integer;
begin
  /* A runaway-script backstop, far above what a person clicking around
     produces. Not an anti-abuse measure — this counts nothing anybody would
     want to inflate, and there is no rank here to climb. */
  select count(*) into v_recent from page_views
  where ip_hash = p_ip_hash and p_ip_hash <> '' and created_at > now() - interval '10 minutes';
  if v_recent > 300 then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited');
  end if;

  insert into page_views (path, ref_host, entry, ip_hash)
  values (left(p_path, 40), left(p_ref_host, 80), coalesce(p_entry, false), left(coalesce(p_ip_hash, ''), 64));

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function record_view(text, text, boolean, text) to anon, authenticated;

/*
 * ── Reading it ──────────────────────────────────────────────────────────
 *
 * Did the post work — arrivals by source, today:
 *
 *   select coalesce(ref_host, '(direct)') as came_from,
 *          count(*) as arrivals,
 *          count(distinct ip_hash) as people
 *   from page_views
 *   where entry and viewed_on = (now() at time zone 'utc')::date
 *   group by 1 order by 2 desc;
 *
 * The whole funnel in one row. Every stage after the first already existed;
 * this is what was missing from the front of it:
 *
 *   select
 *     (select count(distinct ip_hash) from page_views
 *       where entry and viewed_on = current_date)                        as arrived,
 *     (select count(*) from page_views
 *       where path = '/slop' and viewed_on = current_date)               as opened_slop,
 *     (select count(*) from runs where created_at::date = current_date)  as started_a_run,
 *     (select count(*) from runs
 *       where status = 'open' and beacon_at is not null
 *         and created_at::date = current_date)                           as left_midrun,
 *     (select count(*) from runs
 *       where status = 'finished' and created_at::date = current_date)   as finished,
 *     (select count(*) from runs
 *       where handle is not null and created_at::date = current_date)    as put_a_name_up;
 *
 * Which pages people actually open:
 *
 *   select path, count(*) as views, count(distinct ip_hash) as people
 *   from page_views where viewed_on = current_date group by 1 order by 2 desc;
 */
