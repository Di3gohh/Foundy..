alter table public.empresa_catalogo_itens
  add column if not exists retirado_por_nome text,
  add column if not exists retirado_em timestamptz;

create index if not exists empresa_catalogo_itens_retirado_idx
  on public.empresa_catalogo_itens (empresa_usuario_id, status, retirado_em desc);
