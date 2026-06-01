-- Foundy segunda fase: pagamentos, hierarquia empresarial e Ponto Seguro.
-- Esta migração mantém a API compatível com planos pagos, checkout automático e painel de Ponto Seguro.

alter table public.usuarios
  add column if not exists safe_point_latitude double precision,
  add column if not exists safe_point_longitude double precision,
  add column if not exists safe_point_service_days text,
  add column if not exists safe_point_clicks integer not null default 0,
  add column if not exists custom_cover_url text,
  add column if not exists custom_logo_url text,
  add column if not exists public_whatsapp text,
  add column if not exists public_email text,
  add column if not exists public_opening_hours text,
  add column if not exists public_address_visible boolean not null default false,
  add column if not exists public_slug text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'usuarios_safe_point_latitude_chk') then
    alter table public.usuarios
      add constraint usuarios_safe_point_latitude_chk
      check (safe_point_latitude is null or (safe_point_latitude >= -90 and safe_point_latitude <= 90));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'usuarios_safe_point_longitude_chk') then
    alter table public.usuarios
      add constraint usuarios_safe_point_longitude_chk
      check (safe_point_longitude is null or (safe_point_longitude >= -180 and safe_point_longitude <= 180));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'usuarios_safe_point_clicks_chk') then
    alter table public.usuarios
      add constraint usuarios_safe_point_clicks_chk
      check (safe_point_clicks >= 0);
  end if;
end $$;

create index if not exists usuarios_safe_point_geo_idx
  on public.usuarios (is_safe_point, safe_point_status, safe_point_latitude, safe_point_longitude);

create unique index if not exists usuarios_public_slug_unique_idx
  on public.usuarios (public_slug)
  where public_slug is not null and public_slug <> '';

alter table public.monetization_requests
  add column if not exists manual_payment_reference text,
  add column if not exists payment_provider text,
  add column if not exists provider_preference_id text,
  add column if not exists provider_payment_id text,
  add column if not exists checkout_url text,
  add column if not exists payment_status text not null default 'pending';

alter table public.support_contributions
  add column if not exists payment_provider text,
  add column if not exists provider_preference_id text,
  add column if not exists provider_payment_id text,
  add column if not exists checkout_url text,
  add column if not exists payment_status text not null default 'pending';

alter table public.loss_alert_boosts
  add column if not exists payment_provider text,
  add column if not exists provider_preference_id text,
  add column if not exists provider_payment_id text,
  add column if not exists checkout_url text,
  add column if not exists payment_status text not null default 'pending';

alter table public.billing_subscriptions
  add column if not exists provider text,
  add column if not exists provider_subscription_id text,
  add column if not exists amount_cents integer,
  add column if not exists admin_notes text;

create index if not exists monetization_requests_payment_reference_idx
  on public.monetization_requests (manual_payment_reference, payment_status);

create index if not exists support_contributions_payment_reference_idx
  on public.support_contributions (manual_payment_reference, payment_status);

create index if not exists loss_alert_boosts_payment_reference_idx
  on public.loss_alert_boosts (manual_payment_reference, payment_status);
