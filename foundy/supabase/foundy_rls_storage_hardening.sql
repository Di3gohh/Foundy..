-- Hardening complementar antes de abrir o Foundy publicamente.
-- Mantem imagens publicas por URL, mas evita listagem ampla do bucket via Data API.

drop policy if exists "Imagens Foundy publicas" on storage.objects;

-- Estas tabelas sao operadas pelo backend com chave de servico.
-- As policies abaixo mantem anon/authenticated sem leitura/escrita direta,
-- mas removem o alerta de "RLS enabled no policy" sem abrir dados sensiveis.
drop policy if exists "Sem acesso direto publico - avaliacoes" on public.avaliacoes_devolucao;
create policy "Sem acesso direto publico - avaliacoes"
on public.avaliacoes_devolucao
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists "Sem acesso direto publico - denuncias posts" on public.denuncias_posts;
create policy "Sem acesso direto publico - denuncias posts"
on public.denuncias_posts
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists "Sem acesso direto publico - moderacao" on public.moderacao_eventos;
create policy "Sem acesso direto publico - moderacao"
on public.moderacao_eventos
for all
to anon, authenticated
using (false)
with check (false);
