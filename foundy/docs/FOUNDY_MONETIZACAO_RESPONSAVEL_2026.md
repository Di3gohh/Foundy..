# Foundy - Monetização Responsável 2026

Este documento resume a camada de monetização implementada para o Foundy sem bloquear a missão principal da plataforma.

## Regra central

Usuários comuns continuam podendo gratuitamente:

- publicar item achado;
- publicar alerta de perda;
- conversar quando o fluxo de segurança liberar;
- recuperar ou devolver itens;
- denunciar abusos;
- usar mapa, feed e recursos essenciais.

O Foundy nunca deve cobrar para recuperar item, abrir chat, responder desafio ou publicar item achado.

## Fase 1 implementada

- Empresa Verificada com solicitação manual e aprovação administrativa.
- Ponto Seguro Foundy com solicitação manual e aprovação administrativa.
- Apoie o Foundy com registro de intenção de apoio e pagamento manual.
- Alerta Ampliado para alertas de perda, com ativação manual pelo administrador.

## Fase 2 preparada

- Estrutura de membros de empresa.
- Estrutura de planos para eventos.
- Estrutura de assinaturas futuras.
- Relatório inicial de catálogo empresarial.
- QR/link público para empresas.
- Página pública de empresa por slug.

## Variáveis de ambiente novas

- `FOUNDY_SUPPORT_PIX_KEY`: chave PIX opcional para instruções de pagamento manual.
- `SUPPORT_EMAIL`: e-mail oficial de suporte, já usado como `foundy.company@gmail.com`.

Se `FOUNDY_SUPPORT_PIX_KEY` não existir, a API orienta o usuário a concluir pelo e-mail oficial.

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

- `usuarios`: plano, selo verificado, ponto seguro, perfil público e dados de página.
- `alertas_perdidos`: status de destaque temporário.

## Observação de produto

A monetização deve ser comunicada como apoio à comunidade, visibilidade opcional e estrutura empresarial. Evite linguagem predatória como "pague para recuperar" ou "garanta seu item de volta".
