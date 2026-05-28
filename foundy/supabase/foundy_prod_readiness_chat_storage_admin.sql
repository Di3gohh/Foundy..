create schema if not exists extensions;
create extension if not exists postgis with schema extensions;

alter table public.usuarios
  add column if not exists empresa_cnpj text,
  add column if not exists empresa_cep text,
  add column if not exists empresa_verificacao_status text default null,
  add column if not exists ultimo_ip_hash text;

do $$
begin
  alter table public.usuarios
    add constraint usuarios_empresa_verificacao_status_chk
    check (empresa_verificacao_status is null or empresa_verificacao_status in ('pendente', 'aprovada', 'recusada'));
exception
  when duplicate_object then null;
end $$;

create table if not exists public.ips_bloqueados (
  id uuid primary key default extensions.gen_random_uuid(),
  ip_hash text not null unique,
  usuario_id uuid references public.usuarios(id) on delete set null,
  motivo text not null,
  banido_ate timestamptz,
  permanente boolean not null default false,
  admin_usuario_id uuid references public.usuarios(id) on delete set null,
  criado_em timestamptz not null default now()
);

create index if not exists ips_bloqueados_usuario_idx
  on public.ips_bloqueados (usuario_id, criado_em desc);

alter table public.ips_bloqueados enable row level security;

drop policy if exists "Bloqueio direto publico" on public.ips_bloqueados;
create policy "Bloqueio direto publico"
on public.ips_bloqueados
for all
to anon, authenticated
using (false)
with check (false);

grant all on public.ips_bloqueados to service_role;

alter table public.denuncias_extorsao
  alter column sala_chat_id drop not null,
  alter column item_achado_id drop not null,
  alter column usuario_denunciante_id drop not null;

alter table public.denuncias_extorsao
  drop constraint if exists denuncias_extorsao_status_check;

alter table public.denuncias_extorsao
  add constraint denuncias_extorsao_status_check
  check (status in ('pendente', 'em_revisao', 'resolvida', 'descartada'));

alter table public.empresa_catalogo_itens
  add column if not exists subcategoria text;

create index if not exists empresa_catalogo_itens_categoria_idx
  on public.empresa_catalogo_itens (empresa_usuario_id, categoria, subcategoria, status, criado_em desc);

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
  hashtags text[]
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
    alerta.hashtags
  from public.alertas_perdidos alerta
  where alerta.status = 'ativo'
    and st_dwithin(
      alerta.localizacao_referencia,
      st_setsrid(st_makepoint(longitude_usuario, latitude_usuario), 4326)::geography,
      raio_busca_metros
    )
  order by distancia_metros asc, alerta.criado_em desc
  limit limite_resultados;
$$;

grant execute on function public.buscar_alertas_perdidos_por_proximidade(double precision, double precision, integer, integer)
  to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('foundy-images', 'foundy-images', true, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Imagens Foundy publicas" on storage.objects;
create policy "Imagens Foundy publicas"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'foundy-images');
