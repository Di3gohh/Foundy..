from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status

from app.core.config import settings


COMPANY_PLAN_PRICES = {
    "company_verified": 4990,
    "safe_point": 2990,
    "company_pro": 5990,
    "event_plan": 0,
}

LOSS_ALERT_BOOSTS = {
    "24h": {"label": "24 horas", "amount_cents": 490, "duration": timedelta(hours=24)},
    "3d": {"label": "3 dias", "amount_cents": 990, "duration": timedelta(days=3)},
    "7d": {"label": "7 dias", "amount_cents": 1990, "duration": timedelta(days=7)},
}


def money_from_cents(amount_cents: int) -> str:
    value = amount_cents / 100
    return f"R$ {value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def manual_reference(prefix: str, identifier: str | UUID | None = None) -> str:
    suffix = str(identifier or datetime.now(timezone.utc).timestamp()).replace("-", "")[:10].upper()
    return f"FOUNDY-{prefix.upper()}-{suffix}"


def public_plans() -> dict:
    return {
        "titulo": "Monetização responsável",
        "subtitulo": (
            "O Foundy continua gratuito para encontrar e devolver itens. "
            "Os planos pagos ajudam a manter segurança, moderação e infraestrutura."
        ),
        "support_email": settings.support_email,
        "plans": [
            {
                "id": "company_verified",
                "title": "Empresa Verificada",
                "price": "R$ 49,90/mês",
                "amount_cents": COMPANY_PLAN_PRICES["company_verified"],
                "description": "Selo de confiança, página pública, QR Code e mais visibilidade para catálogos institucionais.",
                "benefits": [
                    "Selo de Empresa Verificada",
                    "Página pública personalizada",
                    "QR Code para recepção ou balcão",
                    "Catálogo com destaque na aba Empresas",
                    "Suporte prioritário por e-mail",
                ],
                "ethical_notice": "O selo indica análise cadastral, mas usuários ainda devem seguir o Protocolo Foundy.",
                "cta": "Quero verificar minha empresa",
            },
            {
                "id": "safe_point",
                "title": "Ponto Seguro Foundy",
                "price": "a partir de R$ 29,90/mês",
                "amount_cents": COMPANY_PLAN_PRICES["safe_point"],
                "description": "Locais parceiros onde devoluções podem ser combinadas em ambiente público e monitorado.",
                "benefits": [
                    "Selo Ponto Seguro Foundy",
                    "Aparece como ponto seguro no mapa",
                    "Página pública com horário de atendimento",
                    "QR Code para orientar usuários",
                ],
                "ethical_notice": "Combine devoluções em locais públicos e nunca compartilhe dados pessoais sensíveis.",
                "cta": "Quero ser um Ponto Seguro",
            },
            {
                "id": "support_foundy",
                "title": "Apoie o Foundy",
                "price": "R$ 3, R$ 5, R$ 10, R$ 20 ou livre",
                "amount_cents": 0,
                "description": "Contribuição voluntária para manter servidores, segurança e melhorias da comunidade.",
                "benefits": [
                    "Ajuda a manter a plataforma gratuita",
                    "Apoia moderação e segurança",
                    "Permite evoluir recursos comunitários",
                ],
                "ethical_notice": "Apoiar é opcional e não altera suas chances de recuperar ou devolver um item.",
                "cta": "Apoiar o Foundy",
            },
            {
                "id": "loss_alert_boost",
                "title": "Alerta Ampliado",
                "price": "R$ 4,90 por 24h; R$ 9,90 por 3 dias; R$ 19,90 por 7 dias",
                "amount_cents": 490,
                "description": "Destaque leve e temporário para alertas de perda criados gratuitamente.",
                "benefits": [
                    "Maior visibilidade no feed de perdas",
                    "Badge de Alerta Ampliado",
                    "Duração limitada e transparente",
                ],
                "ethical_notice": "Este recurso não garante a recuperação do item. Ele apenas aumenta a visibilidade por tempo limitado.",
                "cta": "Ampliar um alerta de perda",
            },
        ],
    }


def manual_payment_instructions(amount_cents: int, reference: str) -> dict:
    instructions = [
        "Pagamento manual nesta fase de testes.",
        f"Referência: {reference}",
        f"Valor: {money_from_cents(amount_cents)}",
        f"Contato oficial: {settings.support_email}",
    ]
    if settings.foundy_support_pix_key:
        instructions.append(f"Chave PIX Foundy: {settings.foundy_support_pix_key}")
    else:
        instructions.append("Chave PIX ainda não configurada. Entre em contato pelo e-mail oficial para concluir.")
    return {
        "manual_payment_reference": reference,
        "support_email": settings.support_email,
        "support_pix_key": settings.foundy_support_pix_key,
        "instructions": instructions,
        "message": "Solicitação registrada. Aguarde confirmação manual pelo Foundy.",
    }


def boost_price(boost_type: str) -> dict:
    if boost_type not in LOSS_ALERT_BOOSTS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Plano de destaque inválido.")
    return LOSS_ALERT_BOOSTS[boost_type]


async def activate_company_plan(supabase, company_id: str, request_type: str, admin_id: UUID, manual_reference_value: str | None, notes: str | None) -> None:
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=30)
    updates = {
        "plan_started_at": now.isoformat(),
        "plan_expires_at": expires_at.isoformat(),
        "manual_payment_reference": manual_reference_value,
        "admin_notes": notes,
        "atualizado_em": now.isoformat(),
    }

    if request_type == "company_verified":
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
        updates.update({"plan_type": "event", "plan_status": "active"})
    else:
        return

    await supabase.table("usuarios").update(updates).eq("id", company_id).execute()


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


async def activate_loss_alert_boost(supabase, boost: dict, admin_id: UUID, notes: str | None) -> dict:
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


# TODO Fase 2: adicionar adaptadores Mercado Pago/Stripe com webhooks assinados.
# TODO Fase 2: renovar assinaturas automaticamente e reconciliar vencimentos via cron.
