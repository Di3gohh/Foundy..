create schema if not exists extensions;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists postgis with schema extensions;

create table if not exists public.usuarios (
  id uuid primary key default extensions.gen_random_uuid(),
  nome text not null check (char_length(nome) between 2 and 80),
  email text not null check (email = lower(email)),
  telefone_hash text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  removido_em timestamptz
);

create unique index if not exists usuarios_email_unico_idx on public.usuarios (lower(email));

create table if not exists public.itens_achados (
  id uuid primary key default extensions.gen_random_uuid(),
  usuario_id uuid references public.usuarios(id) on delete set null,
  titulo text not null check (char_length(titulo) between 3 and 120),
  descricao text not null check (char_length(descricao) between 10 and 2000),
  categoria text not null check (categoria in ('documentos', 'eletronicos', 'chaves', 'vestuario', 'outros')),
  local_descricao text,
  localizacao_aproximada extensions.geography(Point, 4326) not null,
  raio_mascara_metros integer not null default 500 check (raio_mascara_metros between 300 and 1500),
  imagem_url text,
  status text not null default 'publicado' check (status in ('publicado', 'em_conversa', 'devolvido', 'arquivado')),
  premium_ativo boolean not null default false,
  premium_expira_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists itens_achados_localizacao_gix
  on public.itens_achados
  using gist (localizacao_aproximada);

create index if not exists itens_achados_status_categoria_idx
  on public.itens_achados (status, categoria, criado_em desc);

create table if not exists public.mensagens_chat (
  id uuid primary key default extensions.gen_random_uuid(),
  item_achado_id uuid not null references public.itens_achados(id) on delete cascade,
  remetente_usuario_id uuid references public.usuarios(id) on delete set null,
  destinatario_usuario_id uuid references public.usuarios(id) on delete set null,
  mensagem text not null check (char_length(mensagem) between 1 and 2000),
  status_moderacao text not null default 'limpa' check (status_moderacao in ('limpa', 'suspeita_extorsao', 'em_revisao', 'resolvida')),
  motivos_moderacao jsonb not null default '[]'::jsonb,
  criado_em timestamptz not null default now()
);

create index if not exists mensagens_chat_item_criado_idx
  on public.mensagens_chat (item_achado_id, criado_em);

create or replace function public.buscar_itens_achados_por_proximidade(
  latitude_usuario double precision,
  longitude_usuario double precision,
  raio_metros integer default 8000,
  limite_resultados integer default 20
)
returns table (
  id uuid,
  titulo text,
  descricao text,
  categoria text,
  local_descricao text,
  latitude_aproximada double precision,
  longitude_aproximada double precision,
  raio_mascara_metros integer,
  distancia_metros double precision,
  imagem_url text,
  status text,
  criado_em timestamptz
)
language sql
stable
set search_path = public, extensions
as $$
  select
    itens.id,
    itens.titulo,
    itens.descricao,
    itens.categoria,
    itens.local_descricao,
    st_y(itens.localizacao_aproximada::geometry) as latitude_aproximada,
    st_x(itens.localizacao_aproximada::geometry) as longitude_aproximada,
    itens.raio_mascara_metros,
    st_distance(
      itens.localizacao_aproximada,
      st_setsrid(st_makepoint(longitude_usuario, latitude_usuario), 4326)::geography
    ) as distancia_metros,
    itens.imagem_url,
    itens.status,
    itens.criado_em
  from public.itens_achados itens
  where itens.status = 'publicado'
    and st_dwithin(
      itens.localizacao_aproximada,
      st_setsrid(st_makepoint(longitude_usuario, latitude_usuario), 4326)::geography,
      raio_metros
    )
  order by
    case when itens.premium_ativo and itens.premium_expira_em > now() then 0 else 1 end,
    distancia_metros asc,
    itens.criado_em desc
  limit limite_resultados;
$$;

alter table public.usuarios enable row level security;
alter table public.itens_achados enable row level security;
alter table public.mensagens_chat enable row level security;

revoke all on table public.usuarios from anon, authenticated;
revoke all on table public.mensagens_chat from anon, authenticated;

grant select on public.itens_achados to anon, authenticated;
grant all on public.usuarios to service_role;
grant all on public.itens_achados to service_role;
grant all on public.mensagens_chat to service_role;
grant execute on function public.buscar_itens_achados_por_proximidade(double precision, double precision, integer, integer)
  to anon, authenticated, service_role;

drop policy if exists "Leitura publica apenas de itens publicados" on public.itens_achados;
create policy "Leitura publica apenas de itens publicados"
on public.itens_achados
for select
to anon, authenticated
using (status = 'publicado');
