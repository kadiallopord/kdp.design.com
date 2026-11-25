-- =============================================================================
-- SAMMEERE JIME — 3/5 : achats, précommandes, Premium, partage 85/15, retraits
-- =============================================================================
-- Principe de sécurité : le client ne fixe jamais un prix ni un statut payé.
--   1. L'app appelle create_order() : le prix est lu en base.
--   2. L'app ouvre le paiement Wave / Orange Money (Edge Function, à venir).
--   3. Le webhook du fournisseur appelle confirm_order_payment() avec la clé
--      service_role : la commande passe à « paid », l'accès est accordé et les
--      revenus sont répartis 85 % artiste / 15 % SAMMEERE JIME dans le registre.
-- Les montants sont en francs CFA (XOF), entiers, sans centimes.
-- =============================================================================

create type public.order_kind as enum ('album_purchase', 'album_preorder', 'premium_monthly');
create type public.order_status as enum ('pending', 'paid', 'failed', 'cancelled', 'refunded');
create type public.payment_provider as enum ('wave', 'orange_money');

-- -----------------------------------------------------------------------------
-- Coordonnées de retrait de l'artiste (privées)
-- -----------------------------------------------------------------------------
create table public.artist_payout_accounts (
  artist_id  uuid primary key references public.artists (id) on delete cascade,
  provider   public.payment_provider not null,
  phone      text not null check (phone ~ '^\+?[0-9]{8,15}$'),
  holder_name text not null,
  updated_at timestamptz not null default now()
);

alter table public.artist_payout_accounts enable row level security;

create policy "L'artiste gère son compte de retrait"
  on public.artist_payout_accounts for all to authenticated
  using ((select public.owns_artist(artist_id)))
  with check ((select public.owns_artist(artist_id)));

create policy "Les admins voient les comptes de retrait"
  on public.artist_payout_accounts for select to authenticated
  using ((select public.is_admin()));

-- -----------------------------------------------------------------------------
-- Commandes
-- -----------------------------------------------------------------------------
create table public.orders (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete restrict,
  kind              public.order_kind not null,
  album_id          uuid references public.albums (id) on delete restrict,
  amount_xof        integer not null check (amount_xof > 0),
  currency          text not null default 'XOF' check (currency = 'XOF'),
  provider          public.payment_provider not null,
  provider_reference text unique,     -- identifiant de la transaction Wave / Orange Money
  status            public.order_status not null default 'pending',
  created_at        timestamptz not null default now(),
  paid_at           timestamptz,
  updated_at        timestamptz not null default now(),
  constraint order_album_required
    check ((kind in ('album_purchase', 'album_preorder')) = (album_id is not null))
);

create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_album_paid_idx on public.orders (album_id) where status = 'paid';

create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Droits d'accès permanents aux albums (achat ou précommande)
-- -----------------------------------------------------------------------------
create table public.album_entitlements (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  album_id   uuid not null references public.albums (id) on delete cascade,
  source     public.order_kind not null check (source in ('album_purchase', 'album_preorder')),
  order_id   uuid references public.orders (id),
  granted_at timestamptz not null default now(),
  primary key (user_id, album_id)
);

-- -----------------------------------------------------------------------------
-- Abonnements Premium
-- -----------------------------------------------------------------------------
create table public.premium_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  order_id    uuid unique references public.orders (id),
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  created_at  timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index premium_subscriptions_user_idx on public.premium_subscriptions (user_id, ends_at desc);

create or replace function public.is_premium(p_user_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.premium_subscriptions
    where user_id = coalesce(p_user_id, auth.uid())
      and now() >= starts_at and now() < ends_at
  );
$$;

create or replace function public.premium_ends_at()
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select max(ends_at) from public.premium_subscriptions where user_id = auth.uid();
$$;

-- -----------------------------------------------------------------------------
-- Registre des revenus : une ligne par artiste pour chaque vente encaissée
-- -----------------------------------------------------------------------------
create table public.revenue_ledger (
  id                  bigint generated always as identity primary key,
  order_id            uuid references public.orders (id),
  artist_id           uuid references public.artists (id), -- null = revenu Premium non encore réparti
  kind                text not null check (kind in ('album_sale', 'album_preorder', 'premium_pool', 'premium_payout', 'refund')),
  gross_xof           integer not null,
  artist_share_xof    integer not null,
  platform_share_xof  integer not null,
  artist_share_percent numeric(5,2) not null,
  period_month        date,         -- pour la répartition Premium mensuelle
  created_at          timestamptz not null default now(),
  constraint ledger_split_adds_up check (artist_share_xof + platform_share_xof = gross_xof)
);

create index revenue_ledger_artist_idx on public.revenue_ledger (artist_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Retraits des artistes
-- -----------------------------------------------------------------------------
create type public.withdrawal_status as enum ('requested', 'processing', 'paid', 'rejected');

create table public.withdrawals (
  id                 uuid primary key default gen_random_uuid(),
  artist_id          uuid not null references public.artists (id) on delete restrict,
  amount_xof         integer not null check (amount_xof > 0),
  provider           public.payment_provider not null,
  phone              text not null,
  status             public.withdrawal_status not null default 'requested',
  provider_reference text,
  admin_note         text,
  requested_at       timestamptz not null default now(),
  processed_at       timestamptz,
  processed_by       uuid references public.profiles (id)
);

create index withdrawals_artist_idx on public.withdrawals (artist_id, requested_at desc);

-- Solde disponible = part artiste encaissée - retraits non refusés.
create or replace function public.artist_balance(p_artist_id uuid)
returns table (earned_xof bigint, withdrawn_xof bigint, available_xof bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with e as (
    select coalesce(sum(artist_share_xof), 0)::bigint as v
      from public.revenue_ledger where artist_id = p_artist_id
  ), w as (
    select coalesce(sum(amount_xof), 0)::bigint as v
      from public.withdrawals where artist_id = p_artist_id and status <> 'rejected'
  )
  select e.v, w.v, e.v - w.v
    from e, w
   where public.owns_artist(p_artist_id) or public.is_admin() or public.is_service_role();
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.orders enable row level security;
alter table public.album_entitlements enable row level security;
alter table public.premium_subscriptions enable row level security;
alter table public.revenue_ledger enable row level security;
alter table public.withdrawals enable row level security;

-- Lecture uniquement : toute écriture passe par les fonctions ci-dessous.
create policy "Voir ses commandes" on public.orders for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "Voir ses albums achetés" on public.album_entitlements for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "Voir son abonnement" on public.premium_subscriptions for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "L'artiste voit ses revenus" on public.revenue_ledger for select to authenticated
  using ((artist_id is not null and (select public.owns_artist(artist_id))) or (select public.is_admin()));

create policy "L'artiste voit ses retraits" on public.withdrawals for select to authenticated
  using ((select public.owns_artist(artist_id)) or (select public.is_admin()));

create policy "Les admins traitent les retraits" on public.withdrawals for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

revoke insert, update, delete on public.orders, public.album_entitlements,
  public.premium_subscriptions, public.revenue_ledger from anon, authenticated;
revoke insert, delete on public.withdrawals from anon, authenticated;

create or replace function public.stamp_withdrawal_processing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Un retrait payé ou refusé est définitif.
  if old.status in ('paid', 'rejected') then
    raise exception 'Ce retrait est déjà clôturé';
  end if;
  new.artist_id := old.artist_id;
  new.amount_xof := old.amount_xof;
  if new.status in ('paid', 'rejected') then
    new.processed_at := now();
    new.processed_by := auth.uid();
  end if;
  return new;
end;
$$;

create trigger withdrawals_processing before update on public.withdrawals
  for each row execute function public.stamp_withdrawal_processing();

-- -----------------------------------------------------------------------------
-- 1. Créer une commande (appelée par l'app)
-- -----------------------------------------------------------------------------
create or replace function public.create_order(
  p_kind public.order_kind,
  p_provider public.payment_provider,
  p_album_id uuid default null
)
returns public.orders
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_album public.albums;
  v_amount integer;
  v_order public.orders;
begin
  if v_user is null then
    raise exception 'Connexion requise' using errcode = '42501';
  end if;

  if p_kind = 'premium_monthly' then
    select (value #>> '{}')::integer into v_amount
      from public.platform_settings where key = 'premium_monthly_price_xof';
  else
    select * into v_album from public.albums where id = p_album_id;
    if v_album.id is null or v_album.status <> 'approved' then
      raise exception 'Album introuvable';
    end if;
    if exists (select 1 from public.album_entitlements where user_id = v_user and album_id = p_album_id) then
      raise exception 'Vous avez déjà accès à cet album';
    end if;

    if p_kind = 'album_preorder' then
      if not v_album.preorder_enabled or v_album.release_date <= current_date then
        raise exception 'Cet album n''est pas disponible en précommande';
      end if;
      v_amount := coalesce(v_album.preorder_price_xof, v_album.price_xof);
    else
      if v_album.release_date > current_date then
        raise exception 'Cet album n''est pas encore sorti : utilisez la précommande';
      end if;
      v_amount := v_album.price_xof;
    end if;

    if v_amount is null then
      raise exception 'Cet album n''est pas en vente';
    end if;
  end if;

  insert into public.orders (user_id, kind, album_id, amount_xof, provider)
  values (v_user, p_kind, p_album_id, v_amount, p_provider)
  returning * into v_order;

  return v_order;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Confirmer un paiement (webhook Wave / Orange Money, clé service_role)
--    Idempotent : un second appel sur une commande payée ne fait rien.
-- -----------------------------------------------------------------------------
create or replace function public.confirm_order_payment(
  p_order_id uuid,
  p_provider_reference text,
  p_amount_xof integer
)
returns public.orders
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_album public.albums;
  v_percent numeric;
  v_artist_share integer;
  v_start timestamptz;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'Commande introuvable';
  end if;
  if v_order.status = 'paid' then
    return v_order;
  end if;
  if v_order.status <> 'pending' then
    raise exception 'Commande non payable (statut %)', v_order.status;
  end if;
  if p_amount_xof is distinct from v_order.amount_xof then
    raise exception 'Montant reçu (%) différent du montant attendu (%)', p_amount_xof, v_order.amount_xof;
  end if;

  update public.orders
     set status = 'paid', paid_at = now(), provider_reference = p_provider_reference
   where id = p_order_id
  returning * into v_order;

  select (value #>> '{}')::numeric into v_percent
    from public.platform_settings where key = 'artist_share_percent';
  v_percent := coalesce(v_percent, 85);

  if v_order.kind in ('album_purchase', 'album_preorder') then
    select * into v_album from public.albums where id = v_order.album_id;

    insert into public.album_entitlements (user_id, album_id, source, order_id)
    values (v_order.user_id, v_order.album_id, v_order.kind, v_order.id)
    on conflict (user_id, album_id) do nothing;

    v_artist_share := floor(v_order.amount_xof * v_percent / 100);
    insert into public.revenue_ledger
      (order_id, artist_id, kind, gross_xof, artist_share_xof, platform_share_xof, artist_share_percent)
    values
      (v_order.id, v_album.artist_id,
       case v_order.kind when 'album_purchase' then 'album_sale' else 'album_preorder' end,
       v_order.amount_xof, v_artist_share, v_order.amount_xof - v_artist_share, v_percent);
  else
    -- Premium : prolonge l'abonnement en cours ou en démarre un nouveau (30 jours).
    select greatest(now(), coalesce(max(ends_at), now())) into v_start
      from public.premium_subscriptions where user_id = v_order.user_id;
    insert into public.premium_subscriptions (user_id, order_id, starts_at, ends_at)
    values (v_order.user_id, v_order.id, v_start, v_start + interval '30 days');

    -- La part artistes (85 %) va dans une cagnotte répartie chaque mois
    -- selon les écoutes : voir distribute_premium_pool().
    v_artist_share := floor(v_order.amount_xof * v_percent / 100);
    insert into public.revenue_ledger
      (order_id, artist_id, kind, gross_xof, artist_share_xof, platform_share_xof,
       artist_share_percent, period_month)
    values
      (v_order.id, null, 'premium_pool', v_order.amount_xof, v_artist_share,
       v_order.amount_xof - v_artist_share, v_percent, date_trunc('month', now())::date);
  end if;

  return v_order;
end;
$$;

create or replace function public.fail_order_payment(p_order_id uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.orders set status = 'failed' where id = p_order_id and status = 'pending';
$$;

-- -----------------------------------------------------------------------------
-- 3. Demande de retrait (appelée par l'artiste)
-- -----------------------------------------------------------------------------
create or replace function public.request_withdrawal(p_amount_xof integer)
returns public.withdrawals
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_artist uuid := public.my_artist_id();
  v_account public.artist_payout_accounts;
  v_available bigint;
  v_min integer;
  v_row public.withdrawals;
begin
  if v_artist is null then
    raise exception 'Réservé aux artistes' using errcode = '42501';
  end if;

  -- Verrou pour éviter deux demandes simultanées qui dépasseraient le solde.
  perform pg_advisory_xact_lock(hashtext('withdrawal:' || v_artist::text));

  select * into v_account from public.artist_payout_accounts where artist_id = v_artist;
  if v_account.artist_id is null then
    raise exception 'Renseignez d''abord votre numéro Wave ou Orange Money';
  end if;

  select (value #>> '{}')::integer into v_min
    from public.platform_settings where key = 'min_withdrawal_xof';
  if p_amount_xof < coalesce(v_min, 0) then
    raise exception 'Le retrait minimum est de % FCFA', v_min;
  end if;

  select available_xof into v_available from public.artist_balance(v_artist);
  if p_amount_xof > v_available then
    raise exception 'Solde insuffisant (disponible : % FCFA)', v_available;
  end if;

  insert into public.withdrawals (artist_id, amount_xof, provider, phone)
  values (v_artist, p_amount_xof, v_account.provider, v_account.phone)
  returning * into v_row;
  return v_row;
end;
$$;

-- -----------------------------------------------------------------------------
-- Droits d'exécution
-- -----------------------------------------------------------------------------
revoke execute on function public.confirm_order_payment(uuid, text, integer) from public, anon, authenticated;
revoke execute on function public.fail_order_payment(uuid) from public, anon, authenticated;
grant execute on function public.confirm_order_payment(uuid, text, integer) to service_role;
grant execute on function public.fail_order_payment(uuid) to service_role;

revoke execute on function public.create_order(public.order_kind, public.payment_provider, uuid) from public, anon;
revoke execute on function public.request_withdrawal(integer) from public, anon;
grant execute on function public.create_order(public.order_kind, public.payment_provider, uuid) to authenticated;
grant execute on function public.request_withdrawal(integer) to authenticated;
