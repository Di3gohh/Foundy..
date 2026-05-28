alter table public.usuarios
  add column if not exists foto_url text,
  add column if not exists ocupacao text,
  add column if not exists aceita_notificacoes_email boolean not null default true,
  add column if not exists termos_aceitos_em timestamptz,
  add column if not exists maioridade_confirmada_em timestamptz,
  add column if not exists papel text not null default 'usuario',
  add column if not exists banido_ate timestamptz,
  add column if not exists banimento_motivo text;

alter table public.notificacoes
  add column if not exists sala_chat_id uuid references public.salas_chat(id) on delete cascade,
  add column if not exists reivindicacao_id uuid references public.reivindicacoes_item(id) on delete cascade;

create index if not exists notificacoes_sala_chat_id_idx
  on public.notificacoes (sala_chat_id);

create index if not exists notificacoes_reivindicacao_id_idx
  on public.notificacoes (reivindicacao_id);

create table if not exists public.avaliacoes_devolucao (
  id uuid primary key default extensions.gen_random_uuid(),
  item_achado_id uuid not null references public.itens_achados(id) on delete cascade,
  encontrador_usuario_id uuid not null references public.usuarios(id) on delete cascade,
  dono_usuario_id uuid references public.usuarios(id) on delete set null,
  nota integer not null check (nota between 0 and 10),
  pontos_delta integer not null,
  criado_em timestamptz not null default now(),
  unique (item_achado_id, dono_usuario_id)
);

create table if not exists public.moderacao_eventos (
  id uuid primary key default extensions.gen_random_uuid(),
  tipo text not null,
  alvo_tipo text not null,
  alvo_id uuid,
  admin_usuario_id uuid references public.usuarios(id) on delete set null,
  motivo text not null,
  criado_em timestamptz not null default now()
);

create index if not exists avaliacoes_devolucao_encontrador_idx
  on public.avaliacoes_devolucao (encontrador_usuario_id, criado_em desc);

create index if not exists moderacao_eventos_tipo_idx
  on public.moderacao_eventos (tipo, criado_em desc);

alter table public.avaliacoes_devolucao enable row level security;
alter table public.moderacao_eventos enable row level security;

grant all on public.avaliacoes_devolucao to service_role;
grant all on public.moderacao_eventos to service_role;

do $$
begin
  begin
    alter publication supabase_realtime add table public.notificacoes;
  exception
    when duplicate_object then null;
    when undefined_object then
      raise notice 'Publicacao supabase_realtime nao encontrada.';
  end;

  begin
    alter publication supabase_realtime add table public.mensagens_chat;
  exception
    when duplicate_object then null;
    when undefined_object then
      raise notice 'Publicacao supabase_realtime nao encontrada.';
  end;
end $$;
