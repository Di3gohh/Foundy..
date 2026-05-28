alter table public.denuncias_extorsao
  add column if not exists resolvida_em timestamptz;

alter table public.denuncias_posts
  add column if not exists resolvida_em timestamptz;

create index if not exists denuncias_extorsao_resolvida_em_idx
  on public.denuncias_extorsao (resolvida_em desc)
  where resolvida_em is not null;

create index if not exists denuncias_posts_resolvida_em_idx
  on public.denuncias_posts (resolvida_em desc)
  where resolvida_em is not null;
