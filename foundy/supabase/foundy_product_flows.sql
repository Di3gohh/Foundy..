create schema if not exists extensions;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists postgis with schema extensions;

do $$
begin
  create extension if not exists pg_cron;
exception
  when insufficient_privilege then
    raise notice 'pg_cron não foi habilitado automaticamente. Ative a extensão pelo painel do Supabase se desejar agendamento nativo.';
end $$;

alter table public.usuarios
  add column if not exists senha_hash text,
  add column if not exists email_verificado_em timestamptz,
  add column if not exists email_verificacao_token text,
  add column if not exists email_verificacao_expira_em timestamptz,
  add column if not exists pontos_luz integer not null default 0,
  add column if not exists nivel_perfil text not null default 'Novo Guardião';

create unique index if not exists usuarios_email_verificacao_token_idx
  on public.usuarios (email_verificacao_token)
  where email_verificacao_token is not null;

alter table public.itens_achados
  add column if not exists desafio_pergunta text,
  add column if not exists detalhe_oculto_hash text,
  add column if not exists tags_ia text[] not null default '{}',
  add column if not exists hashtags text[] not null default '{}',
  add column if not exists chat_desbloqueado boolean not null default false,
  add column if not exists ultimo_movimento_em timestamptz not null default now(),
  add column if not exists destino_pos_30_dias text not null default 'arquivado',
  add column if not exists devolvido_em timestamptz;

create table if not exists public.reivindicacoes_item (
  id uuid primary key default extensions.gen_random_uuid(),
  item_achado_id uuid not null references public.itens_achados(id) on delete cascade,
  usuario_reivindicante_id uuid references public.usuarios(id) on delete set null,
  resposta_desafio text not null check (char_length(resposta_desafio) between 2 and 500),
  status text not null default 'aguardando_validacao'
    check (status in ('aguardando_validacao', 'aprovada', 'recusada', 'cancelada')),
  observacao_validacao text,
  criado_em timestamptz not null default now(),
  validado_em timestamptz
);

create index if not exists reivindicacoes_item_status_idx
  on public.reivindicacoes_item (item_achado_id, status, criado_em desc);

create table if not exists public.salas_chat (
  id uuid primary key default extensions.gen_random_uuid(),
  item_achado_id uuid not null references public.itens_achados(id) on delete cascade,
  reivindicacao_id uuid not null references public.reivindicacoes_item(id) on delete cascade,
  encontrador_usuario_id uuid references public.usuarios(id) on delete set null,
  dono_usuario_id uuid references public.usuarios(id) on delete set null,
  desbloqueado_em timestamptz,
  status text not null default 'bloqueado' check (status in ('bloqueado', 'aberto', 'encerrado', 'em_revisao')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (reivindicacao_id)
);

alter table public.mensagens_chat
  add column if not exists sala_chat_id uuid references public.salas_chat(id) on delete cascade,
  add column if not exists bloqueada_por_desafio boolean not null default false;

create index if not exists salas_chat_item_idx
  on public.salas_chat (item_achado_id, status, criado_em desc);

create table if not exists public.alertas_perdidos (
  id uuid primary key default extensions.gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  titulo text not null check (char_length(titulo) between 3 and 120),
  descricao text not null check (char_length(descricao) between 10 and 2000),
  hashtags text[] not null default '{}',
  localizacao_referencia extensions.geography(Point, 4326) not null,
  raio_metros integer not null default 5000 check (raio_metros between 500 and 50000),
  status text not null default 'ativo' check (status in ('ativo', 'pausado', 'resolvido', 'arquivado')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists alertas_perdidos_localizacao_gix
  on public.alertas_perdidos using gist (localizacao_referencia);

create index if not exists alertas_perdidos_hashtags_idx
  on public.alertas_perdidos using gin (hashtags);

create table if not exists public.notificacoes (
  id uuid primary key default extensions.gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  tipo text not null check (tipo in ('match_ativo', 'proximidade', 'sistema', 'chat')),
  titulo text not null,
  mensagem text not null,
  item_achado_id uuid references public.itens_achados(id) on delete cascade,
  alerta_perdido_id uuid references public.alertas_perdidos(id) on delete cascade,
  lida_em timestamptz,
  criado_em timestamptz not null default now()
);

create index if not exists notificacoes_usuario_idx
  on public.notificacoes (usuario_id, lida_em, criado_em desc);

drop function if exists public.buscar_itens_achados_por_proximidade(double precision, double precision, integer, integer);
create function public.buscar_itens_achados_por_proximidade(
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
  criado_em timestamptz,
  desafio_pergunta text,
  chat_desbloqueado boolean,
  tags_ia text[]
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
    itens.criado_em,
    itens.desafio_pergunta,
    itens.chat_desbloqueado,
    itens.tags_ia
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

create or replace function public.criar_notificacoes_match_ativo()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  insert into public.notificacoes (usuario_id, tipo, titulo, mensagem, item_achado_id, alerta_perdido_id)
  select
    alerta.usuario_id,
    'match_ativo',
    'Notificação de Proximidade',
    'Encontramos um item achado que combina com o seu alerta perdido.',
    new.id,
    alerta.id
  from public.alertas_perdidos alerta
  where alerta.status = 'ativo'
    and st_dwithin(alerta.localizacao_referencia, new.localizacao_aproximada, alerta.raio_metros)
    and (
      alerta.hashtags && coalesce(new.tags_ia, '{}')
      or alerta.hashtags && coalesce(new.hashtags, '{}')
      or exists (
        select 1
        from unnest(alerta.hashtags) tag
        where new.titulo ilike '%' || tag || '%'
           or new.descricao ilike '%' || tag || '%'
      )
    );

  return new;
end;
$$;

drop trigger if exists itens_achados_match_ativo_trg on public.itens_achados;
create trigger itens_achados_match_ativo_trg
after insert on public.itens_achados
for each row
when (new.status = 'publicado')
execute function public.criar_notificacoes_match_ativo();

create or replace function public.validar_reivindicacao_item(
  reivindicacao_id_param uuid,
  aprovada_param boolean,
  observacao_param text default null
)
returns boolean
language plpgsql
set search_path = public, extensions
as $$
declare
  reivindicacao public.reivindicacoes_item%rowtype;
  item public.itens_achados%rowtype;
begin
  select * into reivindicacao
  from public.reivindicacoes_item
  where id = reivindicacao_id_param;

  if not found then
    return false;
  end if;

  select * into item
  from public.itens_achados
  where id = reivindicacao.item_achado_id;

  update public.reivindicacoes_item
  set status = case when aprovada_param then 'aprovada' else 'recusada' end,
      observacao_validacao = observacao_param,
      validado_em = now()
  where id = reivindicacao_id_param;

  if aprovada_param then
    insert into public.salas_chat (
      item_achado_id,
      reivindicacao_id,
      encontrador_usuario_id,
      dono_usuario_id,
      desbloqueado_em,
      status
    )
    values (
      reivindicacao.item_achado_id,
      reivindicacao.id,
      item.usuario_id,
      reivindicacao.usuario_reivindicante_id,
      now(),
      'aberto'
    )
    on conflict (reivindicacao_id)
    do update set desbloqueado_em = now(), status = 'aberto', atualizado_em = now();

    update public.itens_achados
    set chat_desbloqueado = true,
        status = 'em_conversa',
        ultimo_movimento_em = now()
    where id = reivindicacao.item_achado_id;
  end if;

  return true;
end;
$$;

create or replace function public.confirmar_devolucao_item(
  item_id uuid,
  encontrador_id uuid,
  dono_id uuid default null
)
returns boolean
language plpgsql
set search_path = public, extensions
as $$
declare
  novos_pontos integer;
  novo_nivel text;
begin
  update public.itens_achados
  set status = 'devolvido',
      devolvido_em = now(),
      ultimo_movimento_em = now()
  where id = item_id;

  if not found then
    return false;
  end if;

  update public.usuarios
  set pontos_luz = pontos_luz + 25,
      atualizado_em = now()
  where id = encontrador_id
  returning pontos_luz into novos_pontos;

  novo_nivel := case
    when novos_pontos >= 250 then 'Herói Local'
    when novos_pontos >= 100 then 'Cidadão de Ouro'
    when novos_pontos >= 25 then 'Guardião do Bairro'
    else 'Novo Guardião'
  end;

  update public.usuarios
  set nivel_perfil = novo_nivel
  where id = encontrador_id;

  insert into public.notificacoes (usuario_id, tipo, titulo, mensagem, item_achado_id)
  values (
    encontrador_id,
    'sistema',
    'Pontos de Luz adicionados',
    'Obrigado por ajudar na devolução. Seu perfil recebeu 25 Pontos de Luz.',
    item_id
  );

  if dono_id is not null then
    insert into public.notificacoes (usuario_id, tipo, titulo, mensagem, item_achado_id)
    values (dono_id, 'sistema', 'Item recuperado', 'A devolução foi confirmada com segurança.', item_id);
  end if;

  return true;
end;
$$;

create or replace function public.arquivar_itens_inativos()
returns integer
language plpgsql
set search_path = public
as $$
declare
  total integer;
begin
  update public.itens_achados
  set status = destino_pos_30_dias,
      atualizado_em = now()
  where status in ('publicado', 'em_conversa')
    and ultimo_movimento_em < now() - interval '30 days';

  get diagnostics total = row_count;
  return total;
end;
$$;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule(
      'foundy-arquivar-itens-inativos',
      '15 3 * * *',
      'select public.arquivar_itens_inativos();'
    );
  end if;
exception
  when others then
    raise notice 'Agendamento pg_cron não aplicado: %', sqlerrm;
end $$;

alter table public.reivindicacoes_item enable row level security;
alter table public.salas_chat enable row level security;
alter table public.alertas_perdidos enable row level security;
alter table public.notificacoes enable row level security;

grant all on public.reivindicacoes_item to service_role;
grant all on public.salas_chat to service_role;
grant all on public.alertas_perdidos to service_role;
grant all on public.notificacoes to service_role;
grant execute on function public.validar_reivindicacao_item(uuid, boolean, text) to service_role;
grant execute on function public.confirmar_devolucao_item(uuid, uuid, uuid) to service_role;
grant execute on function public.arquivar_itens_inativos() to service_role;
