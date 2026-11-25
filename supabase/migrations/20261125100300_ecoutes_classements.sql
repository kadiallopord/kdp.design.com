-- =============================================================================
-- SAMMEERE JIME — 4/5 : droits d'écoute, écoutes, classements, statistiques,
-- recommandations et répartition Premium
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Qui peut écouter un titre ?
--   • l'artiste propriétaire et les admins : toujours ;
--   • avant la sortie : seulement ceux qui ont précommandé (ou acheté) l'album ;
--   • après la sortie, selon access_mode (de l'album, sinon du titre) :
--       free     → tout compte connecté
--       premium  → abonnés Premium + acheteurs
--       purchase → acheteurs uniquement
-- -----------------------------------------------------------------------------
create or replace function public.can_stream_track(p_track_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  t public.tracks;
  a public.albums;
  v_artist_ok boolean;
  v_entitled boolean := false;
  v_release date;
  v_mode public.access_mode;
begin
  if v_user is null then
    return false;
  end if;

  select * into t from public.tracks where id = p_track_id;
  if t.id is null then
    return false;
  end if;

  if public.is_admin() or public.owns_artist(t.artist_id) then
    return true;
  end if;

  select status = 'approved' into v_artist_ok from public.artists where id = t.artist_id;
  if t.status <> 'approved' or not coalesce(v_artist_ok, false) then
    return false;
  end if;

  if t.album_id is not null then
    select * into a from public.albums where id = t.album_id;
    if a.status <> 'approved' then
      return false;
    end if;
    v_entitled := exists (
      select 1 from public.album_entitlements where user_id = v_user and album_id = a.id
    );
    v_release := greatest(t.release_date, a.release_date);
    v_mode := a.access_mode;
  else
    v_release := t.release_date;
    v_mode := t.access_mode;
  end if;

  if v_release > current_date then
    return v_entitled;
  end if;

  return case v_mode
    when 'free' then true
    when 'premium' then v_entitled or public.is_premium(v_user)
    when 'purchase' then v_entitled
  end;
end;
$$;

-- Le hors ligne intégré suit les mêmes droits, réservé aux Premium et aux
-- acheteurs (le fichier reste chiffré dans l'app, jamais exporté).
create or replace function public.can_download_offline(p_track_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_stream_track(p_track_id)
     and (
       public.is_premium()
       or public.is_admin()
       or exists (
         select 1 from public.tracks t
         join public.album_entitlements e on e.album_id = t.album_id and e.user_id = auth.uid()
         where t.id = p_track_id
       )
     );
$$;

-- -----------------------------------------------------------------------------
-- Journal des écoutes (base des classements réels)
-- -----------------------------------------------------------------------------
create table public.streams (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  track_id       uuid not null references public.tracks (id) on delete cascade,
  artist_id      uuid not null references public.artists (id) on delete cascade,
  album_id       uuid references public.albums (id) on delete set null,
  seconds_played integer not null check (seconds_played >= 0),
  source         text check (source in ('album', 'playlist', 'search', 'radio', 'recommendation', 'artist', 'chart', 'offline', 'other')),
  is_premium     boolean not null default false,
  counted        boolean not null default false,
  played_at      timestamptz not null default now()
);

create index streams_counted_time_idx on public.streams (played_at desc) include (track_id, artist_id, user_id) where counted;
create index streams_user_track_idx on public.streams (user_id, track_id, played_at desc);
create index streams_artist_time_idx on public.streams (artist_id, played_at desc) where counted;

alter table public.streams enable row level security;

create policy "Voir son historique d'écoute" on public.streams for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

revoke insert, update, delete on public.streams from anon, authenticated;

-- Appelée par le lecteur à la fin (ou à l'arrêt) de chaque lecture.
-- Une écoute compte dans les classements si :
--   • l'utilisateur a le droit d'écouter le titre ;
--   • il a écouté au moins min_stream_seconds (30 s), ou tout le titre s'il est plus court ;
--   • la précédente écoute comptée du même titre date d'au moins la durée du titre ;
--   • il n'a pas déjà 20 écoutes comptées de ce titre aujourd'hui (anti-fraude).
create or replace function public.record_stream(
  p_track_id uuid,
  p_seconds_played integer,
  p_source text default 'other'
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  t public.tracks;
  v_min integer;
  v_counted boolean;
  v_seconds integer;
begin
  if v_user is null then
    raise exception 'Connexion requise' using errcode = '42501';
  end if;
  if not public.can_stream_track(p_track_id) then
    raise exception 'Accès refusé à ce titre' using errcode = '42501';
  end if;

  select * into t from public.tracks where id = p_track_id;
  v_seconds := least(greatest(coalesce(p_seconds_played, 0), 0), t.duration_seconds);

  select (value #>> '{}')::integer into v_min
    from public.platform_settings where key = 'min_stream_seconds';
  v_min := least(coalesce(v_min, 30), t.duration_seconds);

  v_counted := v_seconds >= v_min
    and not public.owns_artist(t.artist_id)
    and not exists (
      select 1 from public.streams
       where user_id = v_user and track_id = p_track_id and counted
         and played_at > now() - make_interval(secs => t.duration_seconds)
    )
    and (
      select count(*) from public.streams
       where user_id = v_user and track_id = p_track_id and counted
         and played_at > now() - interval '1 day'
    ) < 20;

  insert into public.streams (user_id, track_id, artist_id, album_id, seconds_played, source, is_premium, counted)
  values (v_user, p_track_id, t.artist_id, t.album_id, v_seconds,
          case when p_source in ('album', 'playlist', 'search', 'radio', 'recommendation', 'artist', 'chart', 'offline')
               then p_source else 'other' end,
          public.is_premium(v_user), v_counted);

  return v_counted;
end;
$$;

-- -----------------------------------------------------------------------------
-- Classements (calculés uniquement sur les écoutes comptées et les ventes payées)
-- p_days = null → depuis toujours.
-- -----------------------------------------------------------------------------
create or replace function public.chart_top_tracks(p_days integer default 7, p_limit integer default 10)
returns table (rank bigint, track_id uuid, title text, artist_id uuid, stage_name text,
               album_id uuid, cover_path text, plays bigint, listeners bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select row_number() over (order by count(*) desc, count(distinct s.user_id) desc, t.title),
         t.id, t.title, ar.id, ar.stage_name, al.id, al.cover_path,
         count(*), count(distinct s.user_id)
    from public.streams s
    join public.tracks t on t.id = s.track_id and t.status = 'approved'
    join public.artists ar on ar.id = t.artist_id and ar.status = 'approved'
    left join public.albums al on al.id = t.album_id
   where s.counted
     and (p_days is null or s.played_at > now() - make_interval(days => p_days))
   group by t.id, t.title, ar.id, ar.stage_name, al.id, al.cover_path
   order by 1
   limit least(greatest(p_limit, 1), 100);
$$;

create or replace function public.chart_top_artists(p_days integer default 7, p_limit integer default 10)
returns table (rank bigint, artist_id uuid, stage_name text, photo_path text,
               plays bigint, listeners bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select row_number() over (order by count(*) desc, count(distinct s.user_id) desc, ar.stage_name),
         ar.id, ar.stage_name, ar.photo_path, count(*), count(distinct s.user_id)
    from public.streams s
    join public.artists ar on ar.id = s.artist_id and ar.status = 'approved'
   where s.counted
     and (p_days is null or s.played_at > now() - make_interval(days => p_days))
   group by ar.id, ar.stage_name, ar.photo_path
   order by 1
   limit least(greatest(p_limit, 1), 100);
$$;

-- Artistes en progression : écoutes des 7 derniers jours vs les 7 précédents.
create or replace function public.chart_rising_artists(p_limit integer default 10, p_min_plays integer default 10)
returns table (rank bigint, artist_id uuid, stage_name text, photo_path text,
               plays_this_week bigint, plays_last_week bigint, growth_percent numeric)
language sql
stable
security definer
set search_path = ''
as $$
  with w as (
    select s.artist_id,
           count(*) filter (where s.played_at > now() - interval '7 days') as cur,
           count(*) filter (where s.played_at <= now() - interval '7 days') as prev
      from public.streams s
     where s.counted and s.played_at > now() - interval '14 days'
     group by s.artist_id
  )
  select row_number() over (order by (w.cur - w.prev)::numeric / greatest(w.prev, 1) desc, w.cur desc),
         ar.id, ar.stage_name, ar.photo_path, w.cur, w.prev,
         round(100.0 * (w.cur - w.prev) / greatest(w.prev, 1), 1)
    from w
    join public.artists ar on ar.id = w.artist_id and ar.status = 'approved'
   where w.cur >= p_min_plays and w.cur > w.prev
   order by 1
   limit least(greatest(p_limit, 1), 100);
$$;

-- Tendances de la semaine : titres dont les écoutes progressent le plus.
create or replace function public.chart_trending_tracks(p_limit integer default 10, p_min_plays integer default 5)
returns table (rank bigint, track_id uuid, title text, artist_id uuid, stage_name text,
               cover_path text, plays_this_week bigint, plays_last_week bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with w as (
    select s.track_id,
           count(*) filter (where s.played_at > now() - interval '7 days') as cur,
           count(*) filter (where s.played_at <= now() - interval '7 days') as prev
      from public.streams s
     where s.counted and s.played_at > now() - interval '14 days'
     group by s.track_id
  )
  select row_number() over (order by (w.cur - w.prev) desc, w.cur desc),
         t.id, t.title, ar.id, ar.stage_name, al.cover_path, w.cur, w.prev
    from w
    join public.tracks t on t.id = w.track_id and t.status = 'approved'
    join public.artists ar on ar.id = t.artist_id and ar.status = 'approved'
    left join public.albums al on al.id = t.album_id
   where w.cur >= p_min_plays
   order by 1
   limit least(greatest(p_limit, 1), 100);
$$;

create or replace function public.chart_top_selling_albums(p_days integer default null, p_limit integer default 10)
returns table (rank bigint, album_id uuid, title text, artist_id uuid, stage_name text,
               cover_path text, sales bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select row_number() over (order by count(*) desc, al.title),
         al.id, al.title, ar.id, ar.stage_name, al.cover_path, count(*)
    from public.orders o
    join public.albums al on al.id = o.album_id and al.status = 'approved'
    join public.artists ar on ar.id = al.artist_id and ar.status = 'approved'
   where o.status = 'paid'
     and o.kind in ('album_purchase', 'album_preorder')
     and (p_days is null or o.paid_at > now() - make_interval(days => p_days))
   group by al.id, al.title, ar.id, ar.stage_name, al.cover_path
   order by 1
   limit least(greatest(p_limit, 1), 100);
$$;

-- -----------------------------------------------------------------------------
-- Statistiques d'un artiste
-- -----------------------------------------------------------------------------
-- Publiques : abonnés et écoutes (affichées sur le profil).
create or replace function public.get_artist_public_stats(p_artist_id uuid)
returns table (followers bigint, total_plays bigint, monthly_listeners bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select (select count(*) from public.follows f where f.artist_id = p_artist_id),
         (select count(*) from public.streams s where s.artist_id = p_artist_id and s.counted),
         (select count(distinct s.user_id) from public.streams s
           where s.artist_id = p_artist_id and s.counted and s.played_at > now() - interval '30 days')
   where exists (select 1 from public.artists where id = p_artist_id and status = 'approved');
$$;

-- Privées : revenus et ventes (tableau de bord de l'artiste, ou admin).
create or replace function public.get_artist_dashboard(p_artist_id uuid default null)
returns table (
  artist_id uuid, followers bigint, total_plays bigint, plays_30d bigint,
  albums_sold bigint, preorders bigint,
  earned_xof bigint, withdrawn_xof bigint, available_xof bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_artist uuid := coalesce(p_artist_id, public.my_artist_id());
begin
  if v_artist is null or not (public.owns_artist(v_artist) or public.is_admin()) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;

  return query
  select v_artist,
         (select count(*) from public.follows f where f.artist_id = v_artist),
         (select count(*) from public.streams s where s.artist_id = v_artist and s.counted),
         (select count(*) from public.streams s where s.artist_id = v_artist and s.counted
            and s.played_at > now() - interval '30 days'),
         (select count(*) from public.revenue_ledger l where l.artist_id = v_artist and l.kind = 'album_sale'),
         (select count(*) from public.revenue_ledger l where l.artist_id = v_artist and l.kind = 'album_preorder'),
         b.earned_xof, b.withdrawn_xof, b.available_xof
    from public.artist_balance(v_artist) b;
end;
$$;

-- -----------------------------------------------------------------------------
-- Recommandations personnalisées (première version, sans apprentissage)
-- Score = genres et artistes écoutés ces 60 derniers jours + artistes suivis,
-- en écartant les titres déjà très écoutés. Repli sur les tendances.
-- -----------------------------------------------------------------------------
create or replace function public.recommend_tracks(p_limit integer default 20)
returns table (track_id uuid, title text, artist_id uuid, stage_name text,
               cover_path text, reason text, score numeric)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select auth.uid() as uid),
  history as (
    select s.track_id, s.artist_id, t.genre, count(*) as n
      from public.streams s join public.tracks t on t.id = s.track_id, me
     where s.user_id = me.uid and s.played_at > now() - interval '60 days'
     group by s.track_id, s.artist_id, t.genre
  ),
  artist_pref as (select artist_id, sum(n) as w from history group by artist_id),
  genre_pref as (select genre, sum(n) as w from history where genre is not null group by genre),
  followed as (select f.artist_id from public.follows f, me where f.user_id = me.uid),
  popularity as (
    select s.track_id, count(*) as plays from public.streams s
     where s.counted and s.played_at > now() - interval '30 days' group by s.track_id
  ),
  candidates as (
    select t.id, t.title, ar.id as artist_id, ar.stage_name, al.cover_path,
           coalesce(ap.w, 0) * 2
           + coalesce(gp.w, 0)
           + case when fo.artist_id is not null then 10 else 0 end
           + ln(1 + coalesce(p.plays, 0)) as score,
           case
             when fo.artist_id is not null then 'Un artiste que vous suivez'
             when ap.w is not null then 'Parce que vous écoutez ' || ar.stage_name
             when gp.w is not null then 'Dans le style ' || t.genre
             else 'Tendance sur SAMMEERE JIME'
           end as reason
      from public.tracks t
      join public.artists ar on ar.id = t.artist_id and ar.status = 'approved'
      left join public.albums al on al.id = t.album_id
      left join artist_pref ap on ap.artist_id = t.artist_id
      left join genre_pref gp on gp.genre = t.genre
      left join followed fo on fo.artist_id = t.artist_id
      left join popularity p on p.track_id = t.id
     where t.status = 'approved'
       and t.release_date <= current_date
       and (al.id is null or (al.status = 'approved' and al.release_date <= current_date))
       and coalesce((select h.n from history h where h.track_id = t.id), 0) < 5
  )
  select id, title, artist_id, stage_name, cover_path, reason, round(score::numeric, 2)
    from candidates
   order by score desc, random()
   limit least(greatest(p_limit, 1), 50);
$$;

-- -----------------------------------------------------------------------------
-- Répartition mensuelle de la cagnotte Premium (admin ou tâche planifiée)
-- 85 % des abonnements du mois sont partagés entre artistes au prorata des
-- écoutes comptées des abonnés Premium pendant ce mois.
-- -----------------------------------------------------------------------------
create table public.premium_pool_distributions (
  period_month  date primary key,
  pool_xof      integer not null,
  distributed_xof integer not null,
  total_plays   bigint not null,
  created_at    timestamptz not null default now(),
  created_by    uuid references public.profiles (id)
);

alter table public.premium_pool_distributions enable row level security;
create policy "Les admins voient les répartitions" on public.premium_pool_distributions
  for select to authenticated using ((select public.is_admin()));
revoke insert, update, delete on public.premium_pool_distributions from anon, authenticated;

create or replace function public.distribute_premium_pool(p_month date)
returns public.premium_pool_distributions
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', p_month)::date;
  v_pool integer;
  v_total bigint;
  v_done integer := 0;
  v_row public.premium_pool_distributions;
  r record;
  v_share integer;
begin
  if not (public.is_admin() or public.is_service_role()) then
    raise exception 'Réservé aux administrateurs' using errcode = '42501';
  end if;
  if v_month >= date_trunc('month', now())::date then
    raise exception 'Le mois doit être terminé avant la répartition';
  end if;
  if exists (select 1 from public.premium_pool_distributions where period_month = v_month) then
    raise exception 'Ce mois a déjà été réparti';
  end if;

  select coalesce(sum(artist_share_xof), 0) into v_pool
    from public.revenue_ledger
   where kind = 'premium_pool' and period_month = v_month;

  select count(*) into v_total
    from public.streams
   where counted and is_premium
     and played_at >= v_month and played_at < v_month + interval '1 month';

  if v_pool > 0 and v_total > 0 then
    for r in
      select artist_id, count(*) as plays
        from public.streams
       where counted and is_premium
         and played_at >= v_month and played_at < v_month + interval '1 month'
       group by artist_id
    loop
      v_share := floor(v_pool::numeric * r.plays / v_total);
      if v_share > 0 then
        insert into public.revenue_ledger
          (artist_id, kind, gross_xof, artist_share_xof, platform_share_xof, artist_share_percent, period_month)
        values (r.artist_id, 'premium_payout', v_share, v_share, 0, 100, v_month);
        v_done := v_done + v_share;
      end if;
    end loop;
  end if;

  insert into public.premium_pool_distributions (period_month, pool_xof, distributed_xof, total_plays, created_by)
  values (v_month, v_pool, v_done, v_total, auth.uid())
  returning * into v_row;
  return v_row;
end;
$$;

-- -----------------------------------------------------------------------------
-- Tableau de bord administrateur
-- -----------------------------------------------------------------------------
create or replace function public.admin_platform_stats()
returns table (
  users bigint, artists_approved bigint, artists_pending bigint,
  albums_pending bigint, tracks_pending bigint, videos_pending bigint,
  premium_active bigint, plays_7d bigint,
  gross_sales_xof bigint, platform_commission_xof bigint, artist_earnings_xof bigint,
  withdrawals_pending bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs' using errcode = '42501';
  end if;
  return query select
    (select count(*) from public.profiles),
    (select count(*) from public.artists where status = 'approved'),
    (select count(*) from public.artists where status = 'pending'),
    (select count(*) from public.albums where status = 'pending'),
    (select count(*) from public.tracks where status = 'pending'),
    (select count(*) from public.videos where status = 'pending'),
    (select count(distinct user_id) from public.premium_subscriptions where now() between starts_at and ends_at),
    (select count(*) from public.streams where counted and played_at > now() - interval '7 days'),
    (select coalesce(sum(gross_xof), 0)::bigint from public.revenue_ledger where kind in ('album_sale', 'album_preorder', 'premium_pool')),
    (select coalesce(sum(platform_share_xof), 0)::bigint from public.revenue_ledger),
    (select coalesce(sum(artist_share_xof), 0)::bigint from public.revenue_ledger where artist_id is not null),
    (select count(*) from public.withdrawals where status in ('requested', 'processing'));
end;
$$;

-- -----------------------------------------------------------------------------
-- Droits d'exécution
-- -----------------------------------------------------------------------------
revoke execute on function public.record_stream(uuid, integer, text) from public, anon;
grant execute on function public.record_stream(uuid, integer, text) to authenticated;

revoke execute on function public.distribute_premium_pool(date) from public, anon;
grant execute on function public.distribute_premium_pool(date) to authenticated, service_role;

revoke execute on function public.admin_platform_stats() from public, anon;
grant execute on function public.admin_platform_stats() to authenticated;

revoke execute on function public.get_artist_dashboard(uuid) from public, anon;
grant execute on function public.get_artist_dashboard(uuid) to authenticated;
