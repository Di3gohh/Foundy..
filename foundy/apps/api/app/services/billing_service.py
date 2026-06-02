from __future__ import annotations

import asyncio
import json
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status

from app.core.config import settings


COMPANY_PLAN_PRICES = {
    "company_verified": 4990,
    "safe_point": 2990,
    "company_pro": 9990,
    "event_plan": 19900,
}

COMPANY_PLAN_LIMITS = {
    "free": 5,
    "verified": 200,
    "pro": None,
    "event": 500,
}

COMPANY_PLAN_NAMES = {
    "free": "Empresa Básica",
    "verified": "Empresa Verificada",
    "pro": "Empresa Pro",
    "event": "Eventos e Instituições",
}

LOSS_ALERT_BOOSTS = {
    "24h": {"label": "24 horas", "amount_cents": 490, "duration": timedelta(hours=24)},
    "3d": {"label": "3 dias", "amount_cents": 990, "duration": timedelta(days=3)},
    "7d": {"label": "7 dias", "amount_cents": 1990, "duration": timedelta(days=7)},
}


class PaymentGatewayError(RuntimeError):
    pass


def mercado_pago_access_token() -> str | None:
    return settings.mercado_pago_active_access_token


def mercado_pago_environment() -> str:
    return settings.mercado_pago_active_environment


def money_from_cents(amount_cents: int) -> str:
    value = amount_cents / 100
    return f"R$ {value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def manual_reference(prefix: str, identifier: str | UUID | None = None) -> str:
    suffix = str(identifier or datetime.now(timezone.utc).timestamp()).replace("-", "")[:10].upper()
    return f"FOUNDY-{prefix.upper()}-{suffix}"


def company_plan_name(plan_type: str | None) -> str:
    return COMPANY_PLAN_NAMES.get(plan_type or "free", COMPANY_PLAN_NAMES["free"])


def effective_company_plan(plan_type: str | None, plan_status: str | None) -> str:
    if plan_status != "active":
        return "free"
    return plan_type if plan_type in COMPANY_PLAN_LIMITS else "free"


def company_catalog_limit(plan_type: str | None, plan_status: str | None) -> int | None:
    return COMPANY_PLAN_LIMITS[effective_company_plan(plan_type, plan_status)]


def company_plan_allows(plan_type: str | None, plan_status: str | None, feature: str) -> bool:
    plan = effective_company_plan(plan_type, plan_status)
    rules = {
        "catalog_search": {"verified", "pro", "event"},
        "filters": {"verified", "pro", "event"},
        "qr_code": {"verified", "pro", "event"},
        "private_catalog": {"verified", "pro", "event"},
        "history": {"pro", "event"},
        "reports": {"pro"},
        "team": {"pro"},
        "events": {"event"},
        "event_chat": {"event"},
    }
    return plan in rules.get(feature, set())


def public_plans() -> dict:
    support_plan = {
        "id": "support_foundy",
        "category": "support",
        "title": "Apoie o Foundy",
        "price": "R$ 3, R$ 5, R$ 10, R$ 20 ou livre",
        "amount_cents": 0,
        "description": "Contribuição voluntária para manter servidores, segurança, moderação, e-mails e melhorias da comunidade.",
        "benefits": [
            "Ajuda a manter a plataforma gratuita para usuários comuns",
            "Apoia moderação, e-mails transacionais e segurança",
            "Permite evoluir recursos comunitários sem cobrar para recuperar itens",
        ],
        "ethical_notice": "Apoiar é opcional e não altera suas chances de recuperar ou devolver um item.",
        "cta": "Apoiar o Foundy",
    }
    safe_point_plan = {
        "id": "safe_point",
        "category": "safe_point",
        "title": "Ponto Seguro Foundy",
        "price": "a partir de R$ 29,90/mês",
        "amount_cents": COMPANY_PLAN_PRICES["safe_point"],
        "description": "Cadastro separado para locais parceiros que querem receber encontros em ambiente público, movimentado e orientado pelo Protocolo Foundy.",
        "benefits": [
            "Selo Ponto Seguro Foundy após análise",
            "Ponto exato destacado no mapa Foundy",
            "Página pública com foto, descrição, endereço e horário de funcionamento",
            "Opção de sugestão dentro do chat seguro",
            "Painel com contagem de cliques recebidos",
        ],
        "ethical_notice": "O Ponto Seguro não substitui cautela. Encontros continuam sendo responsabilidade dos usuários e devem ocorrer em local público.",
        "cta": "Quero ser um Ponto Seguro",
    }
    loss_alert_boost_plan = {
        "id": "loss_alert_boost",
        "category": "loss_alert",
        "title": "Alerta Ampliado",
        "price": "R$ 4,90 por 24h; R$ 9,90 por 3 dias; R$ 19,90 por 7 dias",
        "amount_cents": LOSS_ALERT_BOOSTS["24h"]["amount_cents"],
        "description": "Destaque leve e temporário para alertas de perda criados gratuitamente.",
        "benefits": [
            "Post fica acima dos alertas não turbinados pelo prazo escolhido",
            "Badge de Alerta Ampliado",
            "Duração limitada, transparente e controlada pelo dono do alerta",
        ],
        "ethical_notice": "Este recurso não garante recuperação. Ele apenas aumenta a visibilidade por tempo limitado.",
        "cta": "Ampliar um alerta de perda",
    }
    company_plans = [
        {
            "id": "company_free",
            "category": "company",
            "plan_type": "free",
            "title": "Empresa Básica",
            "price": "Grátis",
            "amount_cents": 0,
            "item_limit": COMPANY_PLAN_LIMITS["free"],
            "description": "Entrada gratuita para pequenos comércios começarem a organizar achados e perdidos no Foundy.",
            "benefits": [
                "Página pública da empresa",
                "Até 5 itens ativos no catálogo",
                "Badge de empresa cadastrada",
                "Sem filtros e pesquisa no catálogo",
            ],
            "ethical_notice": "A conta nasce como Básica. Verificação, destaque e recursos avançados dependem de análise manual.",
            "cta": "Criar conta empresarial grátis",
        },
        {
            "id": "company_verified",
            "category": "company",
            "plan_type": "verified",
            "title": "Empresa Verificada",
            "price": "R$ 49,90/mês",
            "amount_cents": COMPANY_PLAN_PRICES["company_verified"],
            "item_limit": COMPANY_PLAN_LIMITS["verified"],
            "description": "Plano para comércios locais que querem mais confiança, análise cadastral, QR Code e catálogo completo.",
            "benefits": [
                "Todas as vantagens da Empresa Básica",
                "Até 200 itens ativos no catálogo",
                "CNPJ analisado pela moderação Foundy",
                "Selo Empresa Verificada",
                "QR Code da empresa",
                "Escolha entre página pública e privada",
                "Filtros e pesquisa liberados no catálogo",
            ],
            "ethical_notice": "O selo informa análise cadastral, não garante o estado dos itens nem substitui retirada presencial segura.",
            "cta": "Quero ser Empresa Verificada",
        },
        {
            "id": "company_pro",
            "category": "company",
            "plan_type": "pro",
            "title": "Empresa Pro",
            "price": "R$ 99,90 a R$ 149,90/mês",
            "amount_cents": COMPANY_PLAN_PRICES["company_pro"],
            "item_limit": COMPANY_PLAN_LIMITS["pro"],
            "description": "Para escolas, academias, condomínios e instituições que precisam de operação recorrente e histórico robusto.",
            "benefits": [
                "Todas as vantagens da Empresa Verificada",
                "Catálogo sem limite fixo de itens ativos",
                "Histórico de retiradas e arquivamentos",
                "Relatórios iniciais de operação",
                "Painel completo com utilidades Foundy",
                "Selo de Empresa Pro dourado",
                "Nome dourado na aba Empresas quando a página for pública",
                "Múltiplos funcionários com implantação assistida",
            ],
            "ethical_notice": "Recursos de equipe entram por implantação assistida para evitar acesso indevido ao catálogo institucional.",
            "cta": "Falar sobre Empresa Pro",
        },
        {
            "id": "event_plan",
            "category": "company",
            "plan_type": "event",
            "title": "Eventos e Instituições",
            "price": "R$ 199 a R$ 499 por evento/mês",
            "amount_cents": COMPANY_PLAN_PRICES["event_plan"],
            "item_limit": COMPANY_PLAN_LIMITS["event"],
            "description": "Operação temporária para eventos, feiras, igrejas, clubes e ações com grande circulação de pessoas.",
            "benefits": [
                "Até 500 itens ativos",
                "Página temporária do evento",
                "QR Code do evento",
                "Painel de atendimento",
                "Aba exclusiva de eventos com nome, datas, horários e local",
                "Chat seguro liberado para operação do evento",
            ],
            "ethical_notice": "Eventos exigem alinhamento prévio de atendimento presencial e política clara de retirada.",
            "cta": "Solicitar plano para evento",
        },
    ]
    return {
        "titulo": "Monetização responsável",
        "subtitulo": (
            "O Foundy continua gratuito para encontrar e devolver itens. "
            "Os planos pagos ajudam a manter segurança, moderação e infraestrutura."
        ),
        "support_email": settings.support_email,
        "support_plan": support_plan,
        "safe_point_plan": safe_point_plan,
        "loss_alert_boost_plan": loss_alert_boost_plan,
        "company_plans": company_plans,
        "plans": [support_plan, *company_plans[1:], safe_point_plan, loss_alert_boost_plan],
    }


def manual_payment_instructions(amount_cents: int, reference: str) -> dict:
    instructions = [
        "Pagamento manual nesta fase quando o gateway ainda não estiver configurado.",
        f"Referência: {reference}",
        f"Valor: {money_from_cents(amount_cents)}",
        f"Contato oficial: {settings.support_email}",
    ]
    if settings.foundy_support_pix_key:
        instructions.append(f"Chave PIX Foundy: {settings.foundy_support_pix_key}")
    else:
        instructions.append("Chave PIX ainda não configurada. Entre em contato pelo e-mail oficial para concluir.")
    return {
        "provider": "manual_pix",
        "manual_payment_reference": reference,
        "checkout_url": None,
        "support_email": settings.support_email,
        "support_pix_key": settings.foundy_support_pix_key,
        "instructions": instructions,
        "message": "Solicitação registrada. Aguarde confirmação manual pelo Foundy.",
    }


async def payment_instructions(
    amount_cents: int,
    reference: str,
    title: str,
    description: str,
    payer_email: str | None = None,
    *,
    recurring: bool = False,
) -> dict:
    token = mercado_pago_access_token()
    if token:
        try:
            if recurring:
                if not payer_email:
                    raise PaymentGatewayError("Assinaturas exigem e-mail do pagador.")
                return await create_mercado_pago_subscription(amount_cents, reference, title, description, payer_email, token)
            return await create_mercado_pago_preference(amount_cents, reference, title, description, payer_email, token)
        except PaymentGatewayError:
            # Mantém o usuário destravado caso o provedor esteja temporariamente indisponível.
            pass
    return manual_payment_instructions(amount_cents, reference)


async def _mercado_pago_json_request(path: str, payload: dict[str, object] | None = None, *, token: str | None = None, method: str = "POST") -> dict:
    access_token = token or mercado_pago_access_token()
    if not access_token:
        raise PaymentGatewayError("Mercado Pago não configurado.")
    request = urllib.request.Request(
        f"https://api.mercadopago.com{path}",
        data=json.dumps(payload).encode("utf-8") if payload is not None else None,
        method=method,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
    )
    try:
        raw = await asyncio.to_thread(lambda: urllib.request.urlopen(request, timeout=18).read())
    except (urllib.error.HTTPError, urllib.error.URLError) as exc:
        raise PaymentGatewayError("Não foi possível falar com o Mercado Pago.") from exc
    return json.loads(raw.decode("utf-8"))


async def create_mercado_pago_preference(
    amount_cents: int,
    reference: str,
    title: str,
    description: str,
    payer_email: str | None = None,
    token: str | None = None,
) -> dict:
    api_base = (settings.api_public_url or settings.app_public_url).rstrip("/")
    app_base = settings.app_public_url.rstrip("/")
    payload: dict[str, object] = {
        "items": [
            {
                "title": title[:120],
                "description": description[:240],
                "quantity": 1,
                "currency_id": "BRL",
                "unit_price": round(amount_cents / 100, 2),
            }
        ],
        "external_reference": reference,
        "notification_url": f"{api_base}/payments/mercado-pago/webhook",
        "back_urls": {
            "success": f"{app_base}/monetizacao?pagamento=sucesso&referencia={reference}",
            "failure": f"{app_base}/monetizacao?pagamento=erro&referencia={reference}",
            "pending": f"{app_base}/monetizacao?pagamento=pendente&referencia={reference}",
        },
        "auto_return": "approved",
        "payment_methods": {
            "excluded_payment_types": [],
            "installments": 12,
        },
    }
    if payer_email:
        payload["payer"] = {"email": payer_email}

    response = await _mercado_pago_json_request("/checkout/preferences", payload, token=token)
    checkout_url = response.get("init_point") or response.get("sandbox_init_point")
    if not checkout_url:
        raise PaymentGatewayError("Mercado Pago não retornou link de checkout.")
    return {
        "provider": "mercado_pago",
        "payment_mode": "one_time",
        "payment_environment": mercado_pago_environment(),
        "provider_preference_id": response.get("id"),
        "manual_payment_reference": reference,
        "checkout_url": checkout_url,
        "support_email": settings.support_email,
        "support_pix_key": settings.foundy_support_pix_key,
        "instructions": [
            "Pagamento automático via Mercado Pago.",
            f"Referência: {reference}",
            f"Valor: {money_from_cents(amount_cents)}",
            "Abra o checkout e conclua o pagamento. Após aprovação do Mercado Pago, o Foundy libera o benefício automaticamente.",
        ],
        "message": "Checkout gerado. Esta janela continuará aberta até você concluir ou cancelar.",
    }


async def create_mercado_pago_subscription(
    amount_cents: int,
    reference: str,
    title: str,
    description: str,
    payer_email: str,
    token: str | None = None,
) -> dict:
    app_base = settings.app_public_url.rstrip("/")
    payload: dict[str, object] = {
        "reason": title[:255],
        "external_reference": reference,
        "payer_email": payer_email,
        "auto_recurring": {
            "frequency": 1,
            "frequency_type": "months",
            "transaction_amount": round(amount_cents / 100, 2),
            "currency_id": "BRL",
        },
        "back_url": f"{app_base}/monetizacao?assinatura=retorno&referencia={reference}",
        "status": "pending",
    }
    if description:
        payload["metadata"] = {"description": description[:500]}

    response = await _mercado_pago_json_request("/preapproval", payload, token=token)
    checkout_url = response.get("init_point") or response.get("sandbox_init_point")
    if not checkout_url:
        raise PaymentGatewayError("Mercado Pago não retornou link de assinatura.")
    return {
        "provider": "mercado_pago",
        "payment_mode": "recurring",
        "payment_environment": mercado_pago_environment(),
        "provider_subscription_id": response.get("id"),
        "manual_payment_reference": reference,
        "checkout_url": checkout_url,
        "support_email": settings.support_email,
        "support_pix_key": settings.foundy_support_pix_key,
        "instructions": [
            "Assinatura mensal automática via Mercado Pago.",
            f"Referência: {reference}",
            f"Valor mensal: {money_from_cents(amount_cents)}",
            "Abra o checkout de assinatura e autorize a cobrança. Após a aprovação, o Foundy libera o plano automaticamente.",
            "PIX para mensalidade pode depender das opções liberadas pela sua conta Mercado Pago; cartão é o caminho recorrente principal.",
        ],
        "message": "Checkout de assinatura gerado. Esta janela continuará aberta até você concluir ou cancelar.",
    }


def boost_price(boost_type: str) -> dict:
    if boost_type not in LOSS_ALERT_BOOSTS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Plano de destaque inválido.")
    return LOSS_ALERT_BOOSTS[boost_type]


async def activate_company_plan(
    supabase,
    company_id: str,
    request_type: str,
    admin_id: UUID | str,
    manual_reference_value: str | None,
    notes: str | None,
    *,
    provider: str = "manual_or_gateway",
    provider_subscription_id: str | None = None,
) -> None:
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=30)
    updates = {
        "plan_started_at": now.isoformat(),
        "plan_expires_at": expires_at.isoformat(),
        "manual_payment_reference": manual_reference_value,
        "admin_notes": notes,
        "atualizado_em": now.isoformat(),
    }

    plan_type = None
    if request_type == "company_verified":
        plan_type = "verified"
        updates.update(
            {
                "plan_type": "verified",
                "plan_status": "active",
                "verified_badge": True,
                "empresa_verificada": True,
                "empresa_verificacao_status": "aprovada",
            }
        )
    elif request_type == "safe_point":
        updates.update({"is_safe_point": True, "safe_point_status": "active"})
    elif request_type == "company_pro":
        plan_type = "pro"
        updates.update(
            {
                "plan_type": "pro",
                "plan_status": "active",
                "verified_badge": True,
                "empresa_verificada": True,
                "empresa_verificacao_status": "aprovada",
            }
        )
    elif request_type == "event_plan":
        plan_type = "event"
        updates.update({"plan_type": "event", "plan_status": "active", "verified_badge": True, "empresa_verificada": True})
    else:
        return

    await supabase.table("usuarios").update(updates).eq("id", company_id).execute()
    if plan_type:
        await (
            supabase.table("billing_subscriptions")
            .insert(
                {
                    "company_id": company_id,
                    "plan_type": plan_type,
                    "status": "active",
                    "provider": provider,
                    "provider_subscription_id": provider_subscription_id or manual_reference_value,
                    "current_period_start": now.isoformat(),
                    "current_period_end": expires_at.isoformat(),
                    "amount_cents": COMPANY_PLAN_PRICES.get(request_type, 0),
                    "admin_notes": notes,
                }
            )
            .execute()
        )


async def confirm_support_contribution(supabase, contribution_id: str, admin_id: UUID, notes: str | None) -> None:
    await (
        supabase.table("support_contributions")
        .update(
            {
                "status": "confirmed",
                "confirmed_at": datetime.now(timezone.utc).isoformat(),
                "confirmed_by_admin": str(admin_id),
                "admin_notes": notes,
            }
        )
        .eq("id", contribution_id)
        .execute()
    )


async def activate_loss_alert_boost(supabase, boost: dict, admin_id: UUID | str, notes: str | None) -> dict:
    plan = boost_price(boost["boost_type"])
    now = datetime.now(timezone.utc)
    ends_at = now + plan["duration"]
    await (
        supabase.table("loss_alert_boosts")
        .update(
            {
                "status": "active",
                "starts_at": now.isoformat(),
                "ends_at": ends_at.isoformat(),
                "activated_by_admin": str(admin_id),
                "admin_notes": notes,
            }
        )
        .eq("id", boost["id"])
        .execute()
    )
    await (
        supabase.table("alertas_perdidos")
        .update(
            {
                "boost_ativo": True,
                "boost_expira_em": ends_at.isoformat(),
                "boost_tipo": boost["boost_type"],
                "atualizado_em": now.isoformat(),
            }
        )
        .eq("id", boost["loss_alert_id"])
        .execute()
    )
    return {"starts_at": now.isoformat(), "ends_at": ends_at.isoformat()}
