create index if not exists alertas_perdidos_usuario_id_idx on public.alertas_perdidos (usuario_id);
create index if not exists denuncias_extorsao_item_achado_id_idx on public.denuncias_extorsao (item_achado_id);
create index if not exists denuncias_extorsao_mensagem_chat_id_idx on public.denuncias_extorsao (mensagem_chat_id);
create index if not exists denuncias_extorsao_sala_chat_id_idx on public.denuncias_extorsao (sala_chat_id);
create index if not exists denuncias_extorsao_usuario_denunciante_id_idx on public.denuncias_extorsao (usuario_denunciante_id);
create index if not exists hubs_verificados_usuario_id_idx on public.hubs_verificados (usuario_id);
create index if not exists itens_achados_usuario_id_idx on public.itens_achados (usuario_id);
create index if not exists lost_boost_pagamentos_item_achado_id_idx on public.lost_boost_pagamentos (item_achado_id);
create index if not exists lost_boost_pagamentos_usuario_id_idx on public.lost_boost_pagamentos (usuario_id);
create index if not exists mensagens_chat_destinatario_usuario_id_idx on public.mensagens_chat (destinatario_usuario_id);
create index if not exists mensagens_chat_remetente_usuario_id_idx on public.mensagens_chat (remetente_usuario_id);
create index if not exists notificacoes_alerta_perdido_id_idx on public.notificacoes (alerta_perdido_id);
create index if not exists notificacoes_item_achado_id_idx on public.notificacoes (item_achado_id);
create index if not exists reivindicacoes_item_usuario_reivindicante_id_idx on public.reivindicacoes_item (usuario_reivindicante_id);
create index if not exists salas_chat_dono_usuario_id_idx on public.salas_chat (dono_usuario_id);
create index if not exists salas_chat_encontrador_usuario_id_idx on public.salas_chat (encontrador_usuario_id);

drop index if exists public.mensagens_chat_item_criado_idx;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'alertas_perdidos',
    'denuncias_extorsao',
    'hubs_verificados',
    'lost_boost_pagamentos',
    'mensagens_chat',
    'notificacoes',
    'reivindicacoes_item',
    'salas_chat',
    'usuarios'
  ] loop
    execute format('drop policy if exists "Bloqueio direto publico" on public.%I', table_name);
    execute format(
      'create policy "Bloqueio direto publico" on public.%I for all to anon, authenticated using (false) with check (false)',
      table_name
    );
  end loop;
end $$;

drop policy if exists "Bloqueio direto publico" on public.itens_achados;
