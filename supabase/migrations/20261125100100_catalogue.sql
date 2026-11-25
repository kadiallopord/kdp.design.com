-- =============================================================================
-- SAMMEERE JIME — 2/5 : catalogue (artistes, albums, titres, vidéos, radios)
-- et bibliothèque des auditeurs (abonnements, favoris, playlists)
-- =============================================================================
-- Cycle de validation : un artiste crée un contenu en « draft », le soumet en
-- « pending », puis un admin le passe en « approved » ou « rejected ».
-- Seul le contenu « approved » est visible du public.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Artistes
-- -----------------------------------------------------------------------------
create table public.artists (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null unique references public.profiles (id) on delete cascade,
  stage_name      text not null check (char_length(stage_name) between 1 and 80),
  slug            text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  bio             text check (char_length(bio) <= 5000),
  photo_path      text,
  cover_path      text,
  social_links    jsonb not null default '{}'::jsonb
                  check (jsonb_typeof(social_links) = 'object'),
  genres          text[] not null default '{}',
  is_verified     boolean not null default false,
  status          public.content_status not null default 'pending',
  rejection_reason text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  reviewed_at     timestamptz,
  reviewed_by     uuid references public.profiles (id)
);

comment on column public.artists.social_links is
  'Réseaux sociaux, ex. {"instagram":"…","tiktok":"…","youtube":"…","facebook":"…"}';

-- L'artiste dont le compte connecté est propriétaire.
create or replace function public.my_artist_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.artists where owner_id = auth.uid();
$$;

create or replace function public.owns_artist(p_artist_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.artists
    where id = p_artist_id and owner_id = auth.uid()
  );
$$;

-- Vrai si l'artiste est validé et appartient au compte connecté.
create or replace function public.owns_approved_artist(p_artist_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.artists
    where id = p_artist_id and owner_id = auth.uid() and status = 'approved'
  );
$$;

-- -----------------------------------------------------------------------------
-- Albums
-- -----------------------------------------------------------------------------
-- access_mode décide qui peut écouter les titres une fois l'album sorti :
--   free     : tout compte connecté (avec publicité pour les non-Premium)
--   premium  : abonnés Premium + acheteurs de l'album
--   purchase : acheteurs uniquement (album payant)
create type public.access_mode as enum ('free', 'premium', 'purchase');

create table public.albums (
  id                 uuid primary key default gen_random_uuid(),
  artist_id          uuid not null references public.artists (id) on delete cascade,
  title              text not null check (char_length(title) between 1 and 150),
  description        text check (char_length(description) <= 5000),
  cover_path         text,
  genre              text,
  release_date       date not null default current_date,
  access_mode        public.access_mode not null default 'free',
  price_xof          integer check (price_xof is null or price_xof >= 100),
  preorder_enabled   boolean not null default false,
  preorder_price_xof integer check (preorder_price_xof is null or preorder_price_xof >= 100),
  is_exclusive       boolean not null default false,
  status             public.content_status not null default 'draft',
  rejection_reason   text,
  submitted_at       timestamptz,
  reviewed_at        timestamptz,
  reviewed_by        uuid references public.profiles (id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint album_purchase_needs_price
    check (access_mode <> 'purchase' or price_xof is not null),
  constraint album_preorder_needs_price
    check (not preorder_enabled or coalesce(preorder_price_xof, price_xof) is not null)
);

create index albums_artist_idx on public.albums (artist_id);
create index albums_public_idx on public.albums (release_date desc) where status = 'approved';

-- -----------------------------------------------------------------------------
-- Titres
-- -----------------------------------------------------------------------------
create table public.tracks (
  id               uuid primary key default gen_random_uuid(),
  artist_id        uuid not null references public.artists (id) on delete cascade,
  album_id         uuid references public.albums (id) on delete set null,
  title            text not null check (char_length(title) between 1 and 150),
  track_number     smallint check (track_number > 0),
  duration_seconds integer not null check (duration_seconds > 0),
  genre            text,
  language         text default 'pulaar',
  lyrics           text,
  is_explicit      boolean not null default false,
  is_exclusive     boolean not null default false,
  -- Chemins dans le bucket privé « audio ». Connaître le chemin ne donne aucun
  -- accès : seul l'Edge Function « stream-url » délivre une URL temporaire.
  audio_path       text not null,
  audio_hq_path    text,            -- qualité améliorée, réservée aux Premium
  release_date     date not null default current_date,
  access_mode      public.access_mode not null default 'free',
  status           public.content_status not null default 'draft',
  rejection_reason text,
  submitted_at     timestamptz,
  reviewed_at      timestamptz,
  reviewed_by      uuid references public.profiles (id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on column public.tracks.access_mode is
  'Pour un single (sans album). Pour un titre d''album, c''est le mode de l''album qui s''applique.';

create index tracks_artist_idx on public.tracks (artist_id);
create index tracks_album_idx on public.tracks (album_id);
create index tracks_public_idx on public.tracks (release_date desc) where status = 'approved';

-- Un titre doit appartenir au même artiste que son album.
create or replace function public.check_track_album_artist()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.album_id is not null and not exists (
    select 1 from public.albums where id = new.album_id and artist_id = new.artist_id
  ) then
    raise exception 'Le titre et l''album doivent appartenir au même artiste';
  end if;
  return new;
end;
$$;

create trigger tracks_check_album_artist
  before insert or update of album_id, artist_id on public.tracks
  for each row execute function public.check_track_album_artist();

-- -----------------------------------------------------------------------------
-- Vidéos (clips, exclusivités, interviews, événements culturels)
-- -----------------------------------------------------------------------------
create type public.video_kind as enum ('clip', 'exclusive', 'interview', 'event', 'news');

create table public.videos (
  id               uuid primary key default gen_random_uuid(),
  artist_id        uuid references public.artists (id) on delete cascade, -- null = vidéo éditoriale de la plateforme
  track_id         uuid references public.tracks (id) on delete set null,
  kind             public.video_kind not null default 'clip',
  title            text not null check (char_length(title) between 1 and 150),
  description      text check (char_length(description) <= 5000),
  video_path       text,            -- bucket privé « videos »
  external_url     text check (external_url ~ '^https://'),
  thumbnail_path   text,
  duration_seconds integer check (duration_seconds > 0),
  premium_only     boolean not null default false,
  published_at     timestamptz,
  status           public.content_status not null default 'draft',
  rejection_reason text,
  reviewed_at      timestamptz,
  reviewed_by      uuid references public.profiles (id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint video_has_source check (video_path is not null or external_url is not null)
);

create index videos_public_idx on public.videos (published_at desc) where status = 'approved';
create index videos_artist_idx on public.videos (artist_id);

-- -----------------------------------------------------------------------------
-- Radios et programmation
-- -----------------------------------------------------------------------------
create table public.radio_stations (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text,
  stream_url  text,               -- flux HLS/Icecast en direct, à renseigner
  cover_path  text,
  sort_order  smallint not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.radio_programs (
  id          uuid primary key default gen_random_uuid(),
  station_id  uuid not null references public.radio_stations (id) on delete cascade,
  title       text not null,
  host_name   text,
  description text,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  check (ends_at > starts_at)
);

create index radio_programs_station_time_idx on public.radio_programs (station_id, starts_at);

insert into public.radio_stations (slug, name, description, sort_order) values
  ('sammeere-jime',  'Radio Sammeere Jime',          'La station officielle : nouveautés et exclusivités.', 1),
  ('rap-pulaar',     'Radio Rap Pulaar',             'Le meilleur du rap Pulaar.', 2),
  ('senegal',        'Radio Sénégal',                'Mbalax, rap, afro et variétés du Sénégal.', 3),
  ('afrique',        'Radio Afrique',                'Les sons de tout le continent.', 4),
  ('afrobeat',       'Radio Afrobeat',               'Afrobeat et afropop.', 5),
  ('traditionnelle', 'Radio Musique traditionnelle', 'Musique traditionnelle peule et africaine.', 6);

-- -----------------------------------------------------------------------------
-- Modération : seul un admin peut valider ou refuser un contenu.
-- Un artiste ne peut mettre que « draft » ou « pending ».
-- -----------------------------------------------------------------------------
create or replace function public.enforce_moderation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  privileged boolean := public.is_admin() or public.is_service_role();
begin
  if privileged then
    if tg_op = 'UPDATE' and new.status is distinct from old.status
       and new.status in ('approved', 'rejected') then
      new.reviewed_at := now();
      new.reviewed_by := auth.uid();
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status not in ('draft', 'pending') then
      raise exception 'Un contenu doit être validé par un administrateur' using errcode = '42501';
    end if;
  elsif new.status is distinct from old.status and new.status not in ('draft', 'pending') then
    raise exception 'Un contenu doit être validé par un administrateur' using errcode = '42501';
  end if;

  -- Les champs de validation ne sont pas modifiables par l'artiste.
  if tg_op = 'UPDATE' then
    new.reviewed_at := old.reviewed_at;
    new.reviewed_by := old.reviewed_by;
    new.rejection_reason := old.rejection_reason;
  else
    new.reviewed_at := null;
    new.reviewed_by := null;
    new.rejection_reason := null;
  end if;

  if new.status = 'pending' and (tg_op = 'INSERT' or old.status is distinct from 'pending') then
    if tg_table_name <> 'artists' and tg_table_name <> 'videos' then
      new.submitted_at := now();
    end if;
  end if;
  return new;
end;
$$;

create trigger artists_moderation before insert or update on public.artists
  for each row execute function public.enforce_moderation();
create trigger albums_moderation before insert or update on public.albums
  for each row execute function public.enforce_moderation();
create trigger tracks_moderation before insert or update on public.tracks
  for each row execute function public.enforce_moderation();
create trigger videos_moderation before insert or update on public.videos
  for each row execute function public.enforce_moderation();

-- L'artiste ne peut pas s'auto-certifier.
create or replace function public.protect_artist_verified()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (public.is_admin() or public.is_service_role()) then
    if tg_op = 'INSERT' then
      new.is_verified := false;
    else
      new.is_verified := old.is_verified;
    end if;
  end if;
  return new;
end;
$$;

create trigger artists_protect_verified before insert or update on public.artists
  for each row execute function public.protect_artist_verified();

-- Quand un admin valide une fiche artiste, le compte passe au rôle « artist ».
create or replace function public.promote_approved_artist()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
    update public.profiles
       set role = 'artist'
     where id = new.owner_id and role = 'listener';
  end if;
  return new;
end;
$$;

create trigger artists_promote after insert or update of status on public.artists
  for each row execute function public.promote_approved_artist();

create trigger artists_touch before update on public.artists
  for each row execute function public.touch_updated_at();
create trigger albums_touch before update on public.albums
  for each row execute function public.touch_updated_at();
create trigger tracks_touch before update on public.tracks
  for each row execute function public.touch_updated_at();
create trigger videos_touch before update on public.videos
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- RLS : catalogue
-- -----------------------------------------------------------------------------
alter table public.artists enable row level security;
alter table public.albums enable row level security;
alter table public.tracks enable row level security;
alter table public.videos enable row level security;
alter table public.radio_stations enable row level security;
alter table public.radio_programs enable row level security;

-- Artistes
create policy "Artistes validés visibles par tous"
  on public.artists for select to anon, authenticated
  using (status = 'approved' or owner_id = (select auth.uid()) or (select public.is_admin()));

create policy "Un compte peut proposer sa fiche artiste"
  on public.artists for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "L'artiste modifie sa fiche"
  on public.artists for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "Les admins gèrent les artistes"
  on public.artists for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Albums
create policy "Albums validés visibles par tous"
  on public.albums for select to anon, authenticated
  using (status = 'approved' or (select public.owns_artist(artist_id)) or (select public.is_admin()));

create policy "L'artiste validé ajoute ses albums"
  on public.albums for insert to authenticated
  with check ((select public.owns_approved_artist(artist_id)));

create policy "L'artiste modifie ses albums"
  on public.albums for update to authenticated
  using ((select public.owns_artist(artist_id)))
  with check ((select public.owns_approved_artist(artist_id)));

create policy "L'artiste supprime ses brouillons d'album"
  on public.albums for delete to authenticated
  using ((select public.owns_artist(artist_id)) and status in ('draft', 'rejected'));

create policy "Les admins gèrent les albums"
  on public.albums for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Titres
create policy "Titres validés visibles par tous"
  on public.tracks for select to anon, authenticated
  using (status = 'approved' or (select public.owns_artist(artist_id)) or (select public.is_admin()));

create policy "L'artiste validé ajoute ses titres"
  on public.tracks for insert to authenticated
  with check ((select public.owns_approved_artist(artist_id)));

create policy "L'artiste modifie ses titres"
  on public.tracks for update to authenticated
  using ((select public.owns_artist(artist_id)))
  with check ((select public.owns_approved_artist(artist_id)));

create policy "L'artiste supprime ses brouillons de titre"
  on public.tracks for delete to authenticated
  using ((select public.owns_artist(artist_id)) and status in ('draft', 'rejected'));

create policy "Les admins gèrent les titres"
  on public.tracks for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Vidéos
create policy "Vidéos publiées visibles par tous"
  on public.videos for select to anon, authenticated
  using (
    (status = 'approved' and published_at is not null and published_at <= now())
    or (artist_id is not null and (select public.owns_artist(artist_id)))
    or (select public.is_admin())
  );

create policy "L'artiste validé ajoute ses vidéos"
  on public.videos for insert to authenticated
  with check (artist_id is not null and (select public.owns_approved_artist(artist_id)));

create policy "L'artiste modifie ses vidéos"
  on public.videos for update to authenticated
  using (artist_id is not null and (select public.owns_artist(artist_id)))
  with check (artist_id is not null and (select public.owns_approved_artist(artist_id)));

create policy "L'artiste supprime ses brouillons de vidéo"
  on public.videos for delete to authenticated
  using (artist_id is not null and (select public.owns_artist(artist_id)) and status in ('draft', 'rejected'));

create policy "Les admins gèrent les vidéos"
  on public.videos for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Radios
create policy "Radios visibles par tous"
  on public.radio_stations for select to anon, authenticated
  using (is_active or (select public.is_admin()));

create policy "Les admins gèrent les radios"
  on public.radio_stations for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Programmation visible par tous"
  on public.radio_programs for select to anon, authenticated
  using (true);

create policy "Les admins gèrent la programmation"
  on public.radio_programs for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- -----------------------------------------------------------------------------
-- Bibliothèque de l'auditeur
-- -----------------------------------------------------------------------------
create table public.follows (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  artist_id  uuid not null references public.artists (id) on delete cascade,
  notify     boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id, artist_id)
);
create index follows_artist_idx on public.follows (artist_id);

create table public.favorite_tracks (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  track_id   uuid not null references public.tracks (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, track_id)
);

create table public.favorite_albums (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  album_id   uuid not null references public.albums (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, album_id)
);

create table public.playlists (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 100),
  description text check (char_length(description) <= 1000),
  cover_path  text,
  is_public   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index playlists_owner_idx on public.playlists (owner_id);

create trigger playlists_touch before update on public.playlists
  for each row execute function public.touch_updated_at();

create table public.playlist_tracks (
  playlist_id uuid not null references public.playlists (id) on delete cascade,
  track_id    uuid not null references public.tracks (id) on delete cascade,
  position    integer not null default 0,
  added_at    timestamptz not null default now(),
  primary key (playlist_id, track_id)
);

alter table public.follows enable row level security;
alter table public.favorite_tracks enable row level security;
alter table public.favorite_albums enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_tracks enable row level security;

-- Les abonnements sont lisibles par l'utilisateur et par l'artiste suivi ;
-- le compteur public passe par get_artist_public_stats().
create policy "Voir ses abonnements"
  on public.follows for select to authenticated
  using (user_id = (select auth.uid())
         or (select public.owns_artist(artist_id))
         or (select public.is_admin()));
create policy "Suivre un artiste"
  on public.follows for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Régler ses notifications d'abonnement"
  on public.follows for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Ne plus suivre"
  on public.follows for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "Gérer ses titres favoris"
  on public.favorite_tracks for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Gérer ses albums favoris"
  on public.favorite_albums for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "Voir ses playlists et les playlists publiques"
  on public.playlists for select to anon, authenticated
  using (is_public or owner_id = (select auth.uid()));
create policy "Gérer ses playlists"
  on public.playlists for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create or replace function public.can_read_playlist(p_playlist_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.playlists
    where id = p_playlist_id and (is_public or owner_id = auth.uid())
  );
$$;

create or replace function public.owns_playlist(p_playlist_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.playlists where id = p_playlist_id and owner_id = auth.uid());
$$;

create policy "Lire les titres d'une playlist visible"
  on public.playlist_tracks for select to anon, authenticated
  using ((select public.can_read_playlist(playlist_id)));
create policy "Gérer les titres de ses playlists"
  on public.playlist_tracks for all to authenticated
  using ((select public.owns_playlist(playlist_id)))
  with check ((select public.owns_playlist(playlist_id)));

-- -----------------------------------------------------------------------------
-- Recherche (titres, albums, artistes) insensible aux accents
-- -----------------------------------------------------------------------------
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create or replace function public.search_catalog(p_query text, p_limit integer default 20)
returns table (kind text, id uuid, title text, subtitle text, image_path text, score real)
language sql
stable
security definer
set search_path = ''
as $$
  with q as (select extensions.unaccent(lower(trim(p_query))) as q)
  select * from (
    select 'artist'::text, a.id, a.stage_name, null::text, a.photo_path,
           extensions.similarity(extensions.unaccent(lower(a.stage_name)), q.q)
      from public.artists a, q
     where a.status = 'approved'
       and extensions.unaccent(lower(a.stage_name)) like '%' || q.q || '%'
    union all
    select 'album', al.id, al.title, ar.stage_name, al.cover_path,
           extensions.similarity(extensions.unaccent(lower(al.title)), q.q)
      from public.albums al join public.artists ar on ar.id = al.artist_id, q
     where al.status = 'approved' and ar.status = 'approved'
       and extensions.unaccent(lower(al.title)) like '%' || q.q || '%'
    union all
    select 'track', t.id, t.title, ar.stage_name, al.cover_path,
           extensions.similarity(extensions.unaccent(lower(t.title)), q.q)
      from public.tracks t
      join public.artists ar on ar.id = t.artist_id
      left join public.albums al on al.id = t.album_id, q
     where t.status = 'approved' and ar.status = 'approved'
       and extensions.unaccent(lower(t.title)) like '%' || q.q || '%'
  ) r
  where char_length(trim(p_query)) >= 2
  order by 6 desc
  limit least(greatest(p_limit, 1), 50);
$$;
