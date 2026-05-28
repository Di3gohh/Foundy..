create extension if not exists postgis with schema extensions;

alter table public.usuarios
  add column if not exists banimento_tipo text,
  add column if not exists banido_permanente boolean not null default false,
  add column if not exists chat_banido_ate timestamptz,
  add column if not exists chat_banido_permanente boolean not null default false,
  add column if not exists chat_banimento_motivo text,
  add column if not exists ultimo_post_em timestamptz,
  add column if not exists ultimo_aviso_moderacao text,
  add column if not exists ultimo_aviso_em timestamptz,
  add column if not exists empresa_catalogo_publico boolean not null default true;

alter table public.itens_achados
  add column if not exists subcategoria text;

alter table public.alertas_perdidos
  add column if not exists categoria text not null default 'outros',
  add column if not exists subcategoria text,
  add column if not exists local_descricao text,
  add column if not exists imagem_url text;

alter table public.salas_chat
  alter column item_achado_id drop not null,
  alter column reivindicacao_id drop not null,
  add column if not exists alerta_perdido_id uuid references public.alertas_perdidos(id) on delete cascade,
  add column if not exists origem text not null default 'item_achado';

alter table public.mensagens_chat
  alter column item_achado_id drop not null,
  add column if not exists alerta_perdido_id uuid references public.alertas_perdidos(id) on delete cascade;

alter table public.denuncias_extorsao
  add column if not exists usuario_denunciado_id uuid references public.usuarios(id) on delete set null,
  add column if not exists decisao_admin text,
  add column if not exists decidido_em timestamptz,
  add column if not exists admin_usuario_id uuid references public.usuarios(id) on delete set null;

create table if not exists public.denuncias_posts (
  id uuid primary key default extensions.gen_random_uuid(),
  item_achado_id uuid references public.itens_achados(id) on delete cascade,
  alerta_perdido_id uuid references public.alertas_perdidos(id) on delete cascade,
  usuario_denunciante_id uuid references public.usuarios(id) on delete set null,
  usuario_denunciado_id uuid references public.usuarios(id) on delete set null,
  motivo_tipo text not null,
  motivo text not null check (char_length(motivo) between 5 and 700),
  status text not null default 'pendente' check (status in ('pendente', 'avisado', 'banido', 'rejeitado', 'resolvido')),
  decisao_admin text,
  admin_usuario_id uuid references public.usuarios(id) on delete set null,
  criado_em timestamptz not null default now(),
  decidido_em timestamptz,
  constraint denuncias_posts_alvo_chk check (item_achado_id is not null or alerta_perdido_id is not null)
);

create index if not exists usuarios_banimento_idx
  on public.usuarios (banido_permanente, banido_ate, chat_banido_permanente, chat_banido_ate);

create index if not exists itens_achados_usuario_status_idx
  on public.itens_achados (usuario_id, status, criado_em desc);

create index if not exists alertas_perdidos_categoria_idx
  on public.alertas_perdidos (categoria, subcategoria, status, criado_em desc);

create index if not exists salas_chat_alerta_idx
  on public.salas_chat (alerta_perdido_id, status, atualizado_em desc);

create index if not exists mensagens_chat_sala_criado_idx
  on public.mensagens_chat (sala_chat_id, criado_em);

create index if not exists denuncias_posts_status_idx
  on public.denuncias_posts (status, criado_em desc);

drop function if exists public.buscar_itens_achados_por_proximidade(double precision, double precision, integer, integer);
create function public.buscar_itens_achados_por_proximidade(
  latitude_usuario double precision,
  longitude_usuario double precision,
  raio_metros integer default 8000,
  limite_resultados integer default 20
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
  raio_mascara_metros integer,
  distancia_metros double precision,
  imagem_url text,
  status text,
  criado_em timestamptz,
  desafio_pergunta text,
  chat_desbloqueado boolean,
  tags_ia text[],
  hashtags text[],
  premium_ativo boolean,
  premium_expira_em timestamptz
)
language sql
stable
set search_path = public, extensions
as $$
  select
    itens.id,
    itens.usuario_id,
    itens.titulo,
    itens.descricao,
    itens.categoria,
    itens.subcategoria,
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
    itens.criado_em,
    itens.desafio_pergunta,
    itens.chat_desbloqueado,
    itens.tags_ia,
    itens.hashtags,
    itens.premium_ativo,
    itens.premium_expira_em
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

drop function if exists public.buscar_alertas_perdidos_por_proximidade(double precision, double precision, integer, integer);
create function public.buscar_alertas_perdidos_por_proximidade(
  latitude_usuario double precision,
  longitude_usuario double precision,
  raio_metros integer default 8000,
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
      raio_metros
    )
  order by distancia_metros asc, alerta.criado_em desc
  limit limite_resultados;
$$;

alter table public.denuncias_posts enable row level security;

grant all on public.denuncias_posts to service_role;
grant execute on function public.buscar_itens_achados_por_proximidade(double precision, double precision, integer, integer) to service_role;
grant execute on function public.buscar_alertas_perdidos_por_proximidade(double precision, double precision, integer, integer) to service_role;
