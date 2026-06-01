-- Foundy - Monetizacao responsavel, Fase 1 funcional e Fase 2 preparada.
-- Execute no Supabase SQL Editor ou aplique como migration.
-- Esta migration e idempotente e preserva os fluxos gratuitos do Foundy.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists postgis with schema extensions;

alter table public.usuarios
  add column if not exists plan_type text not null default 'free',
  add column if not exists plan_status text not null default 'inactive',
  add column if not exists verified_badge boolean not null default false,
  add column if not exists is_safe_point boolean not null default false,
  add column if not exists safe_point_status text not null default 'none',
  add column if not exists plan_started_at timestamptz,
  add column if not exists plan_expires_at timestamptz,
  add column if not exists manual_payment_reference text,
  add column if not exists admin_notes text,
  add column if not exists public_slug text,
  add column if not exists public_description text,
  add column if not exists public_whatsapp text,
  add column if not exists public_email text,
  add column if not exists public_opening_hours text,
  add column if not exists public_address_visible boolean not null default false,
  add column if not exists custom_cover_url text,
  add column if not exists custom_logo_url text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'usuarios_plan_type_chk') then
    alter table public.usuarios
      add constraint usuarios_plan_type_chk
      check (plan_type in ('free', 'verified', 'pro', 'event'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'usuarios_plan_status_chk') then
    alter table public.usuarios
      add constraint usuarios_plan_status_chk
      check (plan_status in ('inactive', 'active', 'pending_payment', 'expired', 'cancelled'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'usuarios_safe_point_status_chk') then
    alter table public.usuarios
      add constraint usuarios_safe_point_status_chk
      check (safe_point_status in ('none', 'pending', 'active', 'suspended'));
  end if;
end $$;

create unique index if not exists usuarios_public_slug_unico_idx
  on public.usuarios (lower(public_slug))
  where public_slug is not null;

create index if not exists usuarios_plan_status_idx
  on public.usuarios (tipo_conta, plan_type, plan_status, empresa_verificada);

create index if not exists usuarios_safe_point_idx
  on public.usuarios (is_safe_point, safe_point_status, empresa_cidade, empresa_uf);

alter table public.alertas_perdidos
  add column if not exists boost_ativo boolean not null default false,
  add column if not exists boost_expira_em timestamptz,
  add column if not exists boost_tipo text;

create index if not exists alertas_perdidos_boost_idx
  on public.alertas_perdidos (boost_ativo, boost_expira_em desc, criado_em desc)
  where status = 'ativo';

create table if not exists public.monetization_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid references public.usuarios(id) on delete set null,
  company_id uuid references public.usuarios(id) on delete set null,
  request_type text not null check (request_type in ('company_verified', 'safe_point', 'company_pro', 'event_plan', 'sponsorship')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  contact_name text,
  contact_email text,
  contact_phone text,
  message text,
  desired_plan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_by_admin uuid references public.usuarios(id) on delete set null,
  reviewed_at timestamptz,
  admin_notes text
);

create index if not exists monetization_requests_user_idx
  on public.monetization_requests (user_id, created_at desc);

create index if not exists monetization_requests_company_idx
  on public.monetization_requests (company_id, status, created_at desc);

create index if not exists monetization_requests_admin_idx
  on public.monetization_requests (status, request_type, created_at desc);

create table if not exists public.support_contributions (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid references public.usuarios(id) on delete set null,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'BRL',
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  payment_method text not null default 'manual_pix' check (payment_method in ('manual_pix', 'manual_transfer', 'future_gateway')),
  manual_payment_reference text,
  payer_name text,
  payer_email text,
  message text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  confirmed_by_admin uuid references public.usuarios(id) on delete set null,
  admin_notes text
);

create index if not exists support_contributions_user_idx
  on public.support_contributions (user_id, created_at desc);

create index if not exists support_contributions_admin_idx
  on public.support_contributions (status, created_at desc);

create table if not exists public.loss_alert_boosts (
  id uuid primary key default extensions.gen_random_uuid(),
  loss_alert_id uuid not null references public.alertas_perdidos(id) on delete cascade,
  user_id uuid references public.usuarios(id) on delete set null,
  boost_type text not null check (boost_type in ('24h', '3d', '7d')),
  status text not null default 'pending_payment' check (status in ('pending_payment', 'active', 'expired', 'cancelled')),
  starts_at timestamptz,
  ends_at timestamptz,
  amount_cents integer not null check (amount_cents > 0),
  payment_method text not null default 'manual_pix' check (payment_method in ('manual_pix', 'manual_transfer', 'future_gateway')),
  manual_payment_reference text,
  created_at timestamptz not null default now(),
  activated_by_admin uuid references public.usuarios(id) on delete set null,
  admin_notes text
);

create index if not exists loss_alert_boosts_alert_idx
  on public.loss_alert_boosts (loss_alert_id, status, ends_at desc);

create index if not exists loss_alert_boosts_user_idx
  on public.loss_alert_boosts (user_id, created_at desc);

create index if not exists loss_alert_boosts_admin_idx
  on public.loss_alert_boosts (status, created_at desc);

create table if not exists public.company_members (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.usuarios(id) on delete cascade,
  user_id uuid references public.usuarios(id) on delete set null,
  role text not null default 'staff' check (role in ('owner', 'manager', 'staff')),
  status text not null default 'invited' check (status in ('active', 'invited', 'removed')),
  invited_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, user_id)
);

create index if not exists company_members_company_idx
  on public.company_members (company_id, status, role);

create index if not exists company_members_user_idx
  on public.company_members (user_id, status);

create table if not exists public.event_plans (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid references public.usuarios(id) on delete set null,
  title text not null,
  slug text,
  description text,
  location_name text,
  address text,
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'active', 'finished', 'cancelled')),
  plan_status text not null default 'pending_payment' check (plan_status in ('pending_payment', 'active', 'expired', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists event_plans_slug_unico_idx
  on public.event_plans (lower(slug))
  where slug is not null;

create index if not exists event_plans_company_idx
  on public.event_plans (company_id, status, starts_at desc);

create table if not exists public.billing_subscriptions (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.usuarios(id) on delete cascade,
  provider text not null default 'manual' check (provider in ('manual', 'mercado_pago', 'stripe')),
  provider_customer_id text,
  provider_subscription_id text,
  plan_type text not null default 'verified' check (plan_type in ('verified', 'pro', 'event')),
  status text not null default 'pending' check (status in ('pending', 'active', 'past_due', 'cancelled', 'expired')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists billing_subscriptions_company_idx
  on public.billing_subscriptions (company_id, status, current_period_end desc);

drop function if exists public.buscar_alertas_perdidos_por_proximidade(double precision, double precision, integer, integer);
create function public.buscar_alertas_perdidos_por_proximidade(
  latitude_usuario double precision,
  longitude_usuario double precision,
  raio_busca_metros integer default 8000,
  limite_resultados integer default 30
)
returns table (
  id uuid,
  usuario_id uuid,
  titulo text,
  descricao text,
  categoria text,
  subcategoria text,
  local_descricao text,
  latitude_aproximada double precision,
  longitude_aproximada double precision,
  raio_metros integer,
  distancia_metros double precision,
  imagem_url text,
  status text,
  criado_em timestamptz,
  atualizado_em timestamptz,
  hashtags text[],
  boost_ativo boolean,
  boost_expira_em timestamptz,
  boost_tipo text
)
language sql
stable
set search_path = public, extensions
as $$
  select
    alerta.id,
    alerta.usuario_id,
    alerta.titulo,
    alerta.descricao,
    alerta.categoria,
    alerta.subcategoria,
    alerta.local_descricao,
    st_y(alerta.localizacao_referencia::geometry) as latitude_aproximada,
    st_x(alerta.localizacao_referencia::geometry) as longitude_aproximada,
    alerta.raio_metros,
    st_distance(
      alerta.localizacao_referencia,
      st_setsrid(st_makepoint(longitude_usuario, latitude_usuario), 4326)::geography
    ) as distancia_metros,
    alerta.imagem_url,
    alerta.status,
    alerta.criado_em,
    alerta.atualizado_em,
    alerta.hashtags,
    (alerta.boost_ativo and alerta.boost_expira_em > now()) as boost_ativo,
    alerta.boost_expira_em,
    alerta.boost_tipo
  from public.alertas_perdidos alerta
  where alerta.status = 'ativo'
    and st_dwithin(
      alerta.localizacao_referencia,
      st_setsrid(st_makepoint(longitude_usuario, latitude_usuario), 4326)::geography,
      raio_busca_metros
    )
  order by
    (alerta.boost_ativo and alerta.boost_expira_em > now()) desc,
    distancia_metros asc,
    alerta.criado_em desc
  limit limite_resultados;
$$;

grant execute on function public.buscar_alertas_perdidos_por_proximidade(double precision, double precision, integer, integer)
  to service_role;

alter table public.monetization_requests enable row level security;
alter table public.support_contributions enable row level security;
alter table public.loss_alert_boosts enable row level security;
alter table public.company_members enable row level security;
alter table public.event_plans enable row level security;
alter table public.billing_subscriptions enable row level security;

drop policy if exists "Service role monetization requests" on public.monetization_requests;
create policy "Service role monetization requests"
on public.monetization_requests for all to service_role
using (true) with check (true);

drop policy if exists "Service role support contributions" on public.support_contributions;
create policy "Service role support contributions"
on public.support_contributions for all to service_role
using (true) with check (true);

drop policy if exists "Service role loss boosts" on public.loss_alert_boosts;
create policy "Service role loss boosts"
on public.loss_alert_boosts for all to service_role
using (true) with check (true);

drop policy if exists "Service role company members" on public.company_members;
create policy "Service role company members"
on public.company_members for all to service_role
using (true) with check (true);

drop policy if exists "Service role event plans" on public.event_plans;
create policy "Service role event plans"
on public.event_plans for all to service_role
using (true) with check (true);

drop policy if exists "Service role billing subscriptions" on public.billing_subscriptions;
create policy "Service role billing subscriptions"
on public.billing_subscriptions for all to service_role
using (true) with check (true);

revoke all on public.monetization_requests from anon, authenticated;
revoke all on public.support_contributions from anon, authenticated;
revoke all on public.loss_alert_boosts from anon, authenticated;
revoke all on public.company_members from anon, authenticated;
revoke all on public.event_plans from anon, authenticated;
revoke all on public.billing_subscriptions from anon, authenticated;

grant all on public.monetization_requests to service_role;
grant all on public.support_contributions to service_role;
grant all on public.loss_alert_boosts to service_role;
grant all on public.company_members to service_role;
grant all on public.event_plans to service_role;
grant all on public.billing_subscriptions to service_role;
