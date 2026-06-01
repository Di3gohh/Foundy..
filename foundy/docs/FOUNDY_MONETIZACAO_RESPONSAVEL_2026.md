# Foundy - Monetizacao Responsavel 2026

Este documento resume a camada de monetizacao implementada para o Foundy sem bloquear a missao principal da plataforma.

## Regra central

Usuarios comuns continuam podendo gratuitamente:

- publicar item achado;
- publicar alerta de perda;
- conversar quando o fluxo de seguranca liberar;
- recuperar ou devolver itens;
- denunciar abusos;
- usar mapa, feed e recursos essenciais.

O Foundy nunca deve cobrar para recuperar item, abrir chat, responder desafio ou publicar item achado.

## Fase 1 implementada

- Empresa Verificada com solicitacao manual e aprovacao administrativa.
- Ponto Seguro Foundy com solicitacao manual e aprovacao administrativa.
- Apoie o Foundy com registro de intencao de apoio e pagamento manual.
- Alerta Ampliado para alertas de perda, com ativacao manual pelo administrador.

## Fase 2 preparada

- Estrutura de membros de empresa.
- Estrutura de planos para eventos.
- Estrutura de assinaturas futuras.
- Relatorio inicial de catalogo empresarial.
- QR/link publico para empresas.
- Pagina publica de empresa por slug.

## Variaveis de ambiente novas

- `FOUNDY_SUPPORT_PIX_KEY`: chave PIX opcional para instrucoes de pagamento manual.
- `SUPPORT_EMAIL`: e-mail oficial de suporte, ja usado como `foundy.company@gmail.com`.

Se `FOUNDY_SUPPORT_PIX_KEY` nao existir, a API orienta o usuario a concluir pelo e-mail oficial.

## Endpoints principais

- `GET /monetization/plans`
- `GET /monetization/public-summary`
- `POST /monetization/requests`
- `GET /me/monetization/requests`
- `GET /admin/monetization/requests`
- `PATCH /admin/monetization/requests/{id}`
- `POST /support/contributions`
- `GET /me/support/contributions`
- `GET /admin/support/contributions`
- `PATCH /admin/support/contributions/{id}`
- `POST /loss-alerts/{id}/boost`
- `GET /me/loss-alert-boosts`
- `GET /admin/loss-alert-boosts`
- `PATCH /admin/loss-alert-boosts/{id}`
- `GET /companies/{slug}`
- `GET /companies/{id}/public-profile`
- `PATCH /companies/{id}/public-profile`
- `GET /companies/safe-points/nearby`
- `GET /companies/{id}/reports/summary`
- `GET /companies/{id}/qr-code`

## Banco de dados

Migration aplicada:

- `supabase/foundy_monetization_phase1_phase2.sql`

Novas tabelas:

- `monetization_requests`
- `support_contributions`
- `loss_alert_boosts`
- `company_members`
- `event_plans`
- `billing_subscriptions`

Campos adicionados:

- `usuarios`: plano, selo verificado, ponto seguro, perfil publico e dados de pagina.
- `alertas_perdidos`: status de destaque temporario.

## Observacao de produto

A monetizacao deve ser comunicada como apoio a comunidade, visibilidade opcional e estrutura empresarial. Evite linguagem predatoria como "pague para recuperar" ou "garanta seu item de volta".
