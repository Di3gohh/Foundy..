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


def money_from_cents(amount_cents: int) -> str:
    value = amount_cents / 100
    return f"R$ {value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def manual_reference(prefix: str, identifier: str | UUID | None = None) -> str:
    suffix = str(identifier or datetime.now(timezone.utc).timestamp()).replace("-", "")[:10].upper()
    return f"FOUNDY-{prefix.upper()}-{suffix}"


def company_plan_name(plan_type: str | None) -> str:
    return COMPANY_PLAN_NAMES.get(plan_type or "free", COMPANY_PLAN_NAMES["free"])


def company_catalog_limit(plan_type: str | None, plan_status: str | None) -> int | None:
    if plan_status != "active":
        return COMPANY_PLAN_LIMITS["free"]
    return COMPANY_PLAN_LIMITS.get(plan_type or "free", COMPANY_PLAN_LIMITS["free"])


def public_plans() -> dict:
    support_plan = {
        "id": "support_foundy",
        "category": "support",
        "title": "Apoie o Foundy",
        "price": "R$ 3, R$ 5, R$ 10, R$ 20 ou livre",
        "amount_cents": 0,
        "description": "Contribuição voluntária para manter servidores, segurança, moderação e melhorias da comunidade.",
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
        "description": "Oferta para locais parceiros que querem receber devoluções em ambiente público, movimentado e orientado pelo Protocolo Foundy.",
        "benefits": [
            "Selo Ponto Seguro Foundy após análise",
            "Aparece em áreas de orientação do mapa",
            "Página pública com endereço de atendimento e horário",
            "QR Code para balcão, recepção ou mural",
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
            "Mais visibilidade no feed de perdas",
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
                "Catálogo visível ou interno, conforme escolha da empresa",
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
                "CNPJ analisado pela moderação Foundy",
                "Selo Empresa Verificada",
                "QR Code da empresa",
                "Catálogo completo com maior limite de itens ativos",
                "Mais destaque na aba Empresas",
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
                "Catálogo sem limite fixo de itens ativos",
                "Histórico de retiradas e arquivamentos",
                "Relatórios iniciais de operação",
                "Preparado para múltiplos funcionários na Fase 2",
                "Status disponível, retirado e arquivado",
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
                "Página temporária do evento",
                "QR Code do evento",
                "Painel de atendimento",
                "Relatório final de itens cadastrados e retirados",
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
