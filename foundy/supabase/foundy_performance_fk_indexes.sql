-- Indices para chaves estrangeiras usadas pelo painel, chat e moderacao.
-- Evita varreduras desnecessarias quando usuarios, itens ou denuncias forem alterados.

create index if not exists avaliacoes_devolucao_dono_usuario_idx
  on public.avaliacoes_devolucao (dono_usuario_id);

create index if not exists denuncias_extorsao_admin_usuario_idx
  on public.denuncias_extorsao (admin_usuario_id);

create index if not exists denuncias_extorsao_usuario_denunciado_idx
  on public.denuncias_extorsao (usuario_denunciado_id);

create index if not exists denuncias_posts_admin_usuario_idx
  on public.denuncias_posts (admin_usuario_id);

create index if not exists denuncias_posts_alerta_perdido_idx
  on public.denuncias_posts (alerta_perdido_id);

create index if not exists denuncias_posts_item_achado_idx
  on public.denuncias_posts (item_achado_id);

create index if not exists denuncias_posts_usuario_denunciado_idx
  on public.denuncias_posts (usuario_denunciado_id);

create index if not exists denuncias_posts_usuario_denunciante_idx
  on public.denuncias_posts (usuario_denunciante_id);

create index if not exists ips_bloqueados_admin_usuario_idx
  on public.ips_bloqueados (admin_usuario_id);

create index if not exists mensagens_chat_alerta_perdido_idx
  on public.mensagens_chat (alerta_perdido_id);

create index if not exists moderacao_eventos_admin_usuario_idx
  on public.moderacao_eventos (admin_usuario_id);

drop index if exists public.mensagens_chat_sala_idx;
