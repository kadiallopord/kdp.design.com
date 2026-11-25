-- =============================================================================
-- SAMMEERE JIME — 1/5 : comptes, profils et rôles
-- =============================================================================
-- L'inscription et la connexion sont gérées par Supabase Auth (e-mail + mot de
-- passe, ou téléphone + code SMS). Chaque compte auth.users reçoit
-- automatiquement un profil public.profiles avec le rôle « auditeur ».
-- Le rôle « artiste » est attribué quand un administrateur valide la fiche
-- artiste ; le rôle « admin » n'est attribuable que par un administrateur
-- (ou depuis le tableau de bord Supabase pour le tout premier).
-- =============================================================================

create type public.app_role as enum ('listener', 'artist', 'admin');

create type public.content_status as enum ('draft', 'pending', 'approved', 'rejected');

-- -----------------------------------------------------------------------------
-- Profils
-- -----------------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  username      text unique
                check (username ~ '^[a-z0-9_.]{3,30}$'),
  display_name  text not null default 'Auditeur'
                check (char_length(display_name) between 1 and 80),
  avatar_path   text,
  bio           text check (char_length(bio) <= 1000),
  country_code  text not null default 'SN' check (country_code ~ '^[A-Z]{2}$'),
  role          public.app_role not null default 'listener',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.profiles is 'Profil public de chaque compte (auditeur, artiste ou admin).';

-- -----------------------------------------------------------------------------
-- Fonctions d'aide pour les règles d'accès
-- security definer + search_path vide : elles lisent profiles sans repasser
-- par la RLS (évite la récursion) et ne peuvent pas être détournées.
-- -----------------------------------------------------------------------------
create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid()),
    false
  );
$$;

-- Vrai pour les appels serveur : clé service_role (Edge Functions, webhooks)
-- ou connexion directe à la base (éditeur SQL du tableau de bord Supabase).
-- On teste session_user et non current_user, qui vaut « postgres » à
-- l'intérieur de toute fonction security definer.
create or replace function public.is_service_role()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.role() = 'service_role', false)
      or session_user in ('postgres', 'supabase_admin');
$$;

-- -----------------------------------------------------------------------------
-- updated_at automatique
-- -----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Création automatique du profil à l'inscription
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Auditeur'
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Personne ne peut changer son propre rôle, sauf un admin (ou le serveur).
-- -----------------------------------------------------------------------------
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and not (public.is_admin() or public.is_service_role()) then
    raise exception 'Seul un administrateur peut modifier un rôle'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- -----------------------------------------------------------------------------
-- Règles d'accès (RLS)
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;

-- Les profils sont publics (nom, avatar, bio) : nécessaires à l'espace communauté.
create policy "Profils visibles par tous"
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy "Chacun modifie son profil"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Les admins modifient tous les profils"
  on public.profiles for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Pas d'insert/delete côté client : le profil naît et meurt avec le compte.
revoke insert, delete on public.profiles from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Paramètres de la plateforme (prix Premium, part artiste…)
-- -----------------------------------------------------------------------------
create table public.platform_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default now()
);

alter table public.platform_settings enable row level security;

create policy "Paramètres lisibles par tous"
  on public.platform_settings for select
  to anon, authenticated
  using (true);

create policy "Paramètres modifiables par les admins"
  on public.platform_settings for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

insert into public.platform_settings (key, value, description) values
  ('artist_share_percent', '85', 'Part de l''artiste sur chaque vente (en %). Le reste revient à SAMMEERE JIME.'),
  ('premium_monthly_price_xof', '2000', 'Prix de l''abonnement Premium mensuel, en francs CFA (supposition à confirmer).'),
  ('min_stream_seconds', '30', 'Durée minimale d''écoute pour qu''une écoute compte dans les classements.'),
  ('min_withdrawal_xof', '5000', 'Montant minimum d''une demande de retrait artiste (supposition à confirmer).');
