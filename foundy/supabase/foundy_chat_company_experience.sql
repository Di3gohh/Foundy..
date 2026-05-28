create schema if not exists extensions;

create extension if not exists pgcrypto with schema extensions;

alter table public.usuarios
  add column if not exists tipo_conta text not null default 'pessoal'
    check (tipo_conta in ('pessoal', 'empresa')),
  add column if not exists empresa_nome text,
  add column if not exists empresa_descricao text,
  add column if not exists empresa_endereco_publico text,
  add column if not exists empresa_cidade text,
  add column if not exists empresa_uf text,
  add column if not exists empresa_verificada boolean not null default false;

create index if not exists usuarios_tipo_conta_idx
  on public.usuarios (tipo_conta, empresa_verificada, criado_em desc);

create table if not exists public.empresa_catalogo_itens (
  id uuid primary key default extensions.gen_random_uuid(),
  empresa_usuario_id uuid not null references public.usuarios(id) on delete cascade,
  titulo text not null check (char_length(titulo) between 3 and 120),
  descricao text not null check (char_length(descricao) between 5 and 1000),
  categoria text not null check (categoria in ('documentos', 'eletronicos', 'chaves', 'vestuario', 'outros')),
  codigo_interno text,
  local_armazenamento text,
  imagem_url text,
  status text not null default 'disponivel' check (status in ('disponivel', 'retirado', 'arquivado')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists empresa_catalogo_itens_empresa_idx
  on public.empresa_catalogo_itens (empresa_usuario_id, status, criado_em desc);

create table if not exists public.denuncias_extorsao (
  id uuid primary key default extensions.gen_random_uuid(),
  sala_chat_id uuid references public.salas_chat(id) on delete cascade,
  item_achado_id uuid references public.itens_achados(id) on delete cascade,
  usuario_denunciante_id uuid references public.usuarios(id) on delete set null,
  mensagem_chat_id uuid references public.mensagens_chat(id) on delete set null,
  motivo text not null,
  prova_descricao text,
  prova_arquivo_nome text,
  status text not null default 'pendente' check (status in ('pendente', 'em_revisao', 'resolvida', 'descartada')),
  criado_em timestamptz not null default now()
);

alter table public.denuncias_extorsao
  add column if not exists prova_descricao text,
  add column if not exists prova_arquivo_nome text;

alter table public.notificacoes
  add column if not exists sala_chat_id uuid references public.salas_chat(id) on delete cascade,
  add column if not exists reivindicacao_id uuid references public.reivindicacoes_item(id) on delete cascade;

create index if not exists denuncias_extorsao_item_achado_id_idx on public.denuncias_extorsao (item_achado_id);
create index if not exists denuncias_extorsao_mensagem_chat_id_idx on public.denuncias_extorsao (mensagem_chat_id);
create index if not exists denuncias_extorsao_sala_chat_id_idx on public.denuncias_extorsao (sala_chat_id);
create index if not exists denuncias_extorsao_usuario_denunciante_id_idx on public.denuncias_extorsao (usuario_denunciante_id);
create index if not exists notificacoes_chat_unread_idx
  on public.notificacoes (usuario_id, sala_chat_id, lida_em, criado_em desc)
  where tipo = 'chat';

alter table public.empresa_catalogo_itens enable row level security;
alter table public.denuncias_extorsao enable row level security;

drop policy if exists "Bloqueio direto publico" on public.empresa_catalogo_itens;
create policy "Bloqueio direto publico"
on public.empresa_catalogo_itens
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists "Bloqueio direto publico" on public.denuncias_extorsao;
create policy "Bloqueio direto publico"
on public.denuncias_extorsao
for all
to anon, authenticated
using (false)
with check (false);

grant all on public.empresa_catalogo_itens to service_role;
grant all on public.denuncias_extorsao to service_role;
