-- Foundy: pagamentos reais, assinaturas Mercado Pago e alertas regionais por e-mail.

alter table public.usuarios
  add column if not exists alertas_regionais_email boolean not null default true,
  add column if not exists ultima_localizacao_alertas geography(Point, 4326),
  add column if not exists ultima_localizacao_alertas_atualizada_em timestamptz;

create index if not exists idx_usuarios_ultima_localizacao_alertas
  on public.usuarios using gist (ultima_localizacao_alertas);

alter table public.monetization_requests
  add column if not exists provider_subscription_id text,
  add column if not exists subscription_status text,
  add column if not exists payment_environment text;

alter table public.support_contributions
  add column if not exists payment_environment text;

alter table public.loss_alert_boosts
  add column if not exists payment_environment text,
  add column if not exists regional_emails_sent_at timestamptz,
  add column if not exists regional_emails_count integer not null default 0;

alter table public.billing_subscriptions
  add column if not exists payment_environment text,
  add column if not exists external_reference text,
  add column if not exists checkout_url text,
  add column if not exists cancelled_at timestamptz;

create index if not exists idx_monetization_requests_provider_subscription_id
  on public.monetization_requests (provider_subscription_id);

create index if not exists idx_loss_alert_boosts_regional_emails_sent_at
  on public.loss_alert_boosts (regional_emails_sent_at);

create or replace function public.buscar_destinatarios_alerta_impulsionado(
  p_alerta_id uuid,
  p_raio_metros integer default 1000,
  p_limite integer default 250
)
returns table(
  usuario_id uuid,
  nome text,
  email text,
  distancia_metros double precision
)
language sql
stable
set search_path to public, extensions
as $$
  select
    u.id as usuario_id,
    u.nome,
    u.email,
    st_distance(u.ultima_localizacao_alertas, a.localizacao_referencia) as distancia_metros
  from public.alertas_perdidos a
  join public.usuarios u on u.id <> a.usuario_id
  where a.id = p_alerta_id
    and a.status = 'ativo'
    and u.removido_em is null
    and u.email_verificado_em is not null
    and u.aceita_notificacoes_email is true
    and coalesce(u.alertas_regionais_email, true) is true
    and coalesce(u.banido_permanente, false) is false
    and (u.banido_ate is null or u.banido_ate <= now())
    and u.ultima_localizacao_alertas is not null
    and st_dwithin(u.ultima_localizacao_alertas, a.localizacao_referencia, p_raio_metros)
  order by distancia_metros asc, u.ultima_localizacao_alertas_atualizada_em desc nulls last
  limit p_limite;
$$;
