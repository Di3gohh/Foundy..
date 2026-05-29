create table if not exists public.moderacao_infracoes (
  id uuid primary key default extensions.gen_random_uuid(),
  usuario_id uuid references public.usuarios(id) on delete set null,
  origem text not null,
  conteudo_tipo text not null,
  conteudo_id uuid,
  motivos jsonb not null default '[]'::jsonb,
  trecho text,
  ocorrencia integer not null,
  acao_aplicada text not null,
  revisada_em timestamptz,
  criado_em timestamptz not null default now()
);

create index if not exists moderacao_infracoes_usuario_idx
  on public.moderacao_infracoes (usuario_id, criado_em desc);

create index if not exists moderacao_infracoes_acao_idx
  on public.moderacao_infracoes (acao_aplicada, criado_em desc);

alter table public.moderacao_infracoes enable row level security;

drop policy if exists "Sem acesso direto publico - infracoes" on public.moderacao_infracoes;
create policy "Sem acesso direto publico - infracoes"
on public.moderacao_infracoes
for all
to anon, authenticated
using (false)
with check (false);

grant all on public.moderacao_infracoes to service_role;
