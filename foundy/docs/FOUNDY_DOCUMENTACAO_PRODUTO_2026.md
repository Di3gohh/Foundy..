# Foundy - Documentação do Produto e Estado Atual

Versão: 2026.05  
Contato oficial: foundy.company@gmail.com  
Criado por Diego Corazza e Gustavo Alves

## 1. Visão geral

O Foundy é uma aplicação web PWA com frontend em Next.js e backend em FastAPI. O banco usa Supabase/PostgreSQL com PostGIS para busca por proximidade, Supabase Storage para imagens e Supabase Realtime como apoio para mensagens e notificações.

O objetivo é permitir que usuários publiquem itens achados, publiquem alertas de perda, conversem com segurança, denunciem abusos e usem perfis com reputação por karma.

## 2. Arquitetura

Pastas principais:

1. `apps/web`: frontend Next.js, React, Tailwind e PWA.
2. `apps/api`: backend FastAPI, rotas assíncronas, Supabase client e serviços internos.
3. `supabase`: migrações SQL e hardening de banco.
4. `docs`: documentação de produto, termos, segurança e operação.

## 3. Recursos implementados

1. Cadastro e login com e-mail e senha.
2. Persistência de sessão no navegador.
3. Verificação de e-mail via backend e serviço transacional.
4. Feed principal de achados.
5. Feed de perdas.
6. Mapa com itens próximos.
7. Botão "Perto de mim" usando geolocalização do navegador.
8. Formulário para publicar item achado.
9. Formulário para publicar alerta de perda.
10. Upload de imagem com envio para Storage quando configurado.
11. Proteção especial para documentos, evitando foto pública.
12. Sistema de detalhe oculto para provar posse.
13. Chat seguro após aprovação do desafio.
14. Mensagens com atualização automática e suporte a Realtime.
15. Denúncia de extorsão e denúncia de posts.
16. Painel do usuário com itens, alertas, chats, histórico e karma.
17. Painel administrativo exclusivo por e-mail de administrador.
18. Banimento de conta, suspensão de chat, aviso e desbanimento.
19. Painel de denúncias com resolução.
20. Área de empresas com catálogo institucional.
21. Catálogo empresarial com itens disponíveis e retirados.
22. Cadastro empresarial com CNPJ, CEP e solicitação de verificação.
23. Página de segurança e termos.
24. Rodapé com contato oficial.
25. Headers de segurança no Next.js.

## 4. Moderação e IA de segurança

A moderação atual usa um motor determinístico explicável. Ele identifica:

1. Extorsão e cobranças: PIX, pagamento, taxa, resgate, frete antecipado, recompensa obrigatória e variações.
2. Coerção: "só devolvo", "pague primeiro", "se quiser de volta" e padrões semelhantes.
3. Ameaças: violência, exposição de dados, intimidação e perseguição.
4. Golpes: pedido de senha, token, código SMS, cartão e dados bancários.
5. Ofensas: insultos e palavras de baixo calão.
6. Posts proibidos: armas, drogas, documentos falsos, medicamentos controlados e dados pessoais.

Escala automática:

1. Primeira infração: aviso.
2. Segunda infração: suspensão do chat por 30 dias.
3. Terceira infração: suspensão da conta por 30 dias.
4. Quarta infração: banimento permanente.

## 5. E-mails

O backend suporta SMTP e Resend. Para produção, o caminho recomendado é Resend com domínio próprio:

1. `RESEND_API_KEY`: chave privada do Resend.
2. `RESEND_FROM_EMAIL`: remetente do domínio verificado, por exemplo `Foundy <noreply@foundyapp.com.br>`.
3. `SUPPORT_EMAIL`: `foundy.company@gmail.com`.
4. `APP_PUBLIC_URL`: domínio público do site, por exemplo `https://www.foundyapp.com.br`.

O e-mail de resposta deve apontar para o suporte oficial.

## 6. Domínios recomendados

Configuração ideal:

1. `https://www.foundyapp.com.br`: frontend público.
2. `https://foundyapp.com.br`: redirecionamento para `www`.
3. `https://api.foundyapp.com.br`: backend FastAPI.

O frontend deve usar `NEXT_PUBLIC_API_URL=https://api.foundyapp.com.br`.

## 7. Supabase

Componentes esperados:

1. PostgreSQL com PostGIS.
2. RLS habilitado nas tabelas públicas.
3. Service/secret key somente no backend.
4. Publishable key somente no frontend.
5. Storage bucket para imagens públicas tratadas.
6. Realtime habilitado para `mensagens_chat` e `notificacoes`.

Antes do lançamento público, revisar advisors de segurança e performance no Supabase.

## 8. Checklist antes de sair do modo teste

1. Rotacionar chaves expostas em conversas, prints ou documentos.
2. Confirmar domínio do frontend no Vercel.
3. Criar `api.foundyapp.com.br` no projeto da API.
4. Atualizar `NEXT_PUBLIC_API_URL`.
5. Configurar `RESEND_API_KEY` e `RESEND_FROM_EMAIL`.
6. Testar cadastro, verificação de e-mail, login, post, desafio, chat, denúncia e banimento.
7. Testar upload real de imagens no Storage.
8. Rodar auditoria de RLS e advisors.
9. Revisar textos legais com profissional jurídico antes de tráfego real.
10. Definir política comercial de empresas e anúncios.

## 9. Estratégia comercial

Empresas:

1. Plano gratuito limitado para validar mercado.
2. Plano mensal para catálogos públicos e internos.
3. Plano premium com múltiplos operadores, relatórios e SLA.
4. Oferta inicial para escolas, universidades, shoppings, academias e eventos.

Anúncios:

1. Anúncios locais discretos no feed.
2. Patrocínio de regiões.
3. Conteúdo de segurança patrocinado.
4. Evitar anúncios dentro do chat, denúncias e fluxos de recuperação.

## 10. Próximas prioridades técnicas

1. Corrigir definitivamente o domínio público da API.
2. Testar e-mails transacionais em produção.
3. Validar chat ponta a ponta com dois usuários reais.
4. Fortalecer Supabase Storage e limites de upload.
5. Adicionar observabilidade e logs de erro.
6. Preparar página legal final revisada.
7. Criar painel financeiro para planos empresariais.
