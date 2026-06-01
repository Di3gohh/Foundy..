from datetime import datetime, timezone
import re
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, status
from pydantic import BaseModel, EmailStr, Field

from app.core.config import settings
from app.db.supabase_client import get_supabase
from app.services.billing_service import (
    COMPANY_PLAN_PRICES,
    LOSS_ALERT_BOOSTS,
    activate_company_plan,
    activate_loss_alert_boost,
    boost_price,
    confirm_support_contribution,
    manual_payment_instructions,
    manual_reference,
    public_plans,
)
from app.services.email_service import send_support_email


router = APIRouter()

RequestType = Literal["company_verified", "safe_point", "company_pro", "event_plan", "sponsorship"]
RequestStatus = Literal["pending", "approved", "rejected", "cancelled"]
ContributionStatus = Literal["pending", "confirmed", "cancelled"]
BoostStatus = Literal["pending_payment", "active", "expired", "cancelled"]
BoostType = Literal["24h", "3d", "7d"]


class MonetizationRequestCreate(BaseModel):
    user_id: UUID | None = None
    company_id: UUID | None = None
    request_type: RequestType
    contact_name: str | None = Field(default=None, max_length=120)
    contact_email: EmailStr | None = None
    contact_phone: str | None = Field(default=None, max_length=40)
    message: str | None = Field(default=None, max_length=1500)
    desired_plan: str | None = Field(default=None, max_length=80)


class AdminMonetizationRequestUpdate(BaseModel):
    admin_usuario_id: UUID
    status: RequestStatus
    admin_notes: str | None = Field(default=None, max_length=1500)
    plan_expires_at: datetime | None = None


class SupportContributionCreate(BaseModel):
    user_id: UUID | None = None
    amount_cents: int = Field(gt=0, le=100_000_00)
    payer_name: str | None = Field(default=None, max_length=120)
    payer_email: EmailStr | None = None
    message: str | None = Field(default=None, max_length=1000)
    payment_method: Literal["manual_pix", "manual_transfer", "future_gateway"] = "manual_pix"


class AdminSupportContributionUpdate(BaseModel):
    admin_usuario_id: UUID
    status: ContributionStatus
    admin_notes: str | None = Field(default=None, max_length=1200)


class LossAlertBoostCreate(BaseModel):
    user_id: UUID
    boost_type: BoostType


class AdminLossAlertBoostUpdate(BaseModel):
    admin_usuario_id: UUID
    status: BoostStatus
    admin_notes: str | None = Field(default=None, max_length=1200)


class CompanyPublicProfileUpdate(BaseModel):
    usuario_id: UUID
    public_slug: str | None = Field(default=None, max_length=80)
    public_description: str | None = Field(default=None, max_length=1000)
    public_whatsapp: str | None = Field(default=None, max_length=40)
    public_email: EmailStr | None = None
    public_opening_hours: str | None = Field(default=None, max_length=240)
    public_address_visible: bool | None = None
    custom_cover_url: str | None = Field(default=None, max_length=5_000_000)
    custom_logo_url: str | None = Field(default=None, max_length=5_000_000)


def _slugify(value: str) -> str:
    text = value.strip().lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")[:80]


async def _ensure_admin(admin_usuario_id: UUID) -> dict:
    response = await (
        get_supabase()
        .table("usuarios")
        .select("id,email,nome")
        .eq("id", str(admin_usuario_id))
        .is_("removido_em", "null")
        .limit(1)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Administrador não encontrado.")
    admin = response.data[0]
    if admin.get("email", "").lower() not in settings.admin_emails:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso administrativo negado.")
    return admin


async def _ensure_user(usuario_id: UUID) -> dict:
    response = await (
        get_supabase()
        .table("usuarios")
        .select("id,nome,email,tipo_conta,empresa_nome,email_verificado_em,removido_em")
        .eq("id", str(usuario_id))
        .is_("removido_em", "null")
        .limit(1)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")
    return response.data[0]


async def _ensure_company_owner(company_id: UUID, usuario_id: UUID) -> dict:
    if str(company_id) != str(usuario_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Você só pode alterar a própria empresa.")
    company = await _ensure_user(company_id)
    if company.get("tipo_conta") != "empresa":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Esta ação é exclusiva para contas empresariais.")
    return company


async def _notify(usuario_id: str | None, titulo: str, mensagem: str, *, alerta_id: str | None = None) -> None:
    if not usuario_id:
        return
    await (
        get_supabase()
        .table("notificacoes")
        .insert(
            {
                "usuario_id": usuario_id,
                "tipo": "sistema",
                "titulo": titulo,
                "mensagem": mensagem,
                "alerta_perdido_id": alerta_id,
            }
        )
        .execute()
    )


def _with_payment(row: dict, amount_cents: int, prefix: str) -> dict:
    reference = row.get("manual_payment_reference") or manual_reference(prefix, row.get("id"))
    return {**row, "payment": manual_payment_instructions(amount_cents, reference)}


@router.get("/monetization/plans")
async def get_monetization_plans() -> dict:
    return public_plans()


@router.get("/monetization/public-summary")
async def get_public_summary() -> dict:
    return {
        "title": "Foundy cresce sem cobrar para recuperar itens.",
        "summary": (
            "A monetização vem de planos empresariais, pontos seguros, apoio voluntário "
            "e destaque opcional para alertas de perda. Recuperar, devolver e denunciar continuam gratuitos."
        ),
        "support_email": settings.support_email,
        "ethical_rules": [
            "Nunca cobramos para devolver ou recuperar um item.",
            "Alerta Ampliado aumenta visibilidade, mas não garante recuperação.",
            "Empresas verificadas passam por análise cadastral.",
            "Pontos seguros devem ser locais públicos, movimentados e apropriados.",
        ],
    }


@router.post("/monetization/requests", status_code=status.HTTP_201_CREATED)
async def create_monetization_request(payload: MonetizationRequestCreate, background_tasks: BackgroundTasks) -> dict:
    if not payload.user_id and not payload.company_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Informe o usuário ou a empresa da solicitação.")

    supabase = get_supabase()
    company_id = str(payload.company_id or payload.user_id) if payload.request_type in {"company_verified", "safe_point", "company_pro", "event_plan"} else str(payload.company_id) if payload.company_id else None
    user_id = str(payload.user_id or payload.company_id)

    if company_id and payload.request_type in {"company_verified", "safe_point", "company_pro", "event_plan"}:
        company = await _ensure_user(UUID(company_id))
        if company.get("tipo_conta") != "empresa":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Este plano é exclusivo para contas empresariais.")

    reference = manual_reference("PLAN")
    response = await (
        supabase.table("monetization_requests")
        .insert(
            {
                "user_id": user_id,
                "company_id": company_id,
                "request_type": payload.request_type,
                "status": "pending",
                "contact_name": payload.contact_name.strip() if payload.contact_name else None,
                "contact_email": str(payload.contact_email).lower() if payload.contact_email else None,
                "contact_phone": payload.contact_phone.strip() if payload.contact_phone else None,
                "message": payload.message.strip() if payload.message else None,
                "desired_plan": payload.desired_plan or payload.request_type,
                "admin_notes": f"Referência manual inicial: {reference}",
            }
        )
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Não foi possível registrar a solicitação.")

    row = response.data[0]
    background_tasks.add_task(
        send_support_email,
        "Nova solicitação de monetização Foundy",
        (
            f"Tipo: {payload.request_type}\n"
            f"Usuário: {user_id}\n"
            f"Empresa: {company_id or 'não informada'}\n"
            f"Contato: {payload.contact_name or 'não informado'} - {payload.contact_email or 'sem e-mail'}\n"
            f"Mensagem: {payload.message or 'sem mensagem'}\n"
            f"Referência: {reference}"
        ),
    )
    return {
        **row,
        "mensagem": "Solicitação recebida. O Foundy vai analisar e responder pelo contato oficial.",
        "payment": manual_payment_instructions(COMPANY_PLAN_PRICES.get(payload.request_type, 0), reference),
    }


@router.get("/me/monetization/requests")
async def list_my_monetization_requests(user_id: UUID = Query(...)) -> list[dict]:
    await _ensure_user(user_id)
    response = await (
        get_supabase()
        .table("monetization_requests")
        .select("*")
        .or_(f"user_id.eq.{user_id},company_id.eq.{user_id}")
        .order("created_at", desc=True)
        .limit(80)
        .execute()
    )
    return response.data


@router.get("/admin/monetization/requests")
async def list_admin_monetization_requests(admin_usuario_id: UUID = Query(...)) -> list[dict]:
    await _ensure_admin(admin_usuario_id)
    response = await (
        get_supabase()
        .table("monetization_requests")
        .select("*")
        .order("created_at", desc=True)
        .limit(200)
        .execute()
    )
    return response.data


@router.patch("/admin/monetization/requests/{request_id}")
async def update_admin_monetization_request(request_id: UUID, payload: AdminMonetizationRequestUpdate) -> dict:
    await _ensure_admin(payload.admin_usuario_id)
    supabase = get_supabase()
    current = await supabase.table("monetization_requests").select("*").eq("id", str(request_id)).limit(1).execute()
    if not current.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitação não encontrada.")
    row = current.data[0]
    now_iso = datetime.now(timezone.utc).isoformat()
    updates = {
        "status": payload.status,
        "updated_at": now_iso,
        "reviewed_by_admin": str(payload.admin_usuario_id),
        "reviewed_at": now_iso,
        "admin_notes": payload.admin_notes,
    }
    await supabase.table("monetization_requests").update(updates).eq("id", str(request_id)).execute()

    if payload.status == "approved" and row.get("company_id"):
        reference = manual_reference("PLAN", request_id)
        await activate_company_plan(supabase, row["company_id"], row["request_type"], payload.admin_usuario_id, reference, payload.admin_notes)
        await _notify(
            row.get("company_id"),
            "Solicitação aprovada",
            "Sua solicitação de monetização foi aprovada. Os benefícios foram ativados manualmente pelo Foundy.",
        )
    elif payload.status == "rejected":
        await _notify(
            row.get("company_id") or row.get("user_id"),
            "Solicitação de monetização analisada",
            f"Sua solicitação foi recusada. Observação: {payload.admin_notes or 'entre em contato com o suporte para detalhes.'}",
        )

    return {"mensagem": "Solicitação atualizada com segurança."}


@router.post("/support/contributions", status_code=status.HTTP_201_CREATED)
async def create_support_contribution(payload: SupportContributionCreate, background_tasks: BackgroundTasks) -> dict:
    if payload.user_id:
        await _ensure_user(payload.user_id)
    reference = manual_reference("APOIO")
    response = await (
        get_supabase()
        .table("support_contributions")
        .insert(
            {
                "user_id": str(payload.user_id) if payload.user_id else None,
                "amount_cents": payload.amount_cents,
                "status": "pending",
                "payment_method": payload.payment_method,
                "manual_payment_reference": reference,
                "payer_name": payload.payer_name.strip() if payload.payer_name else None,
                "payer_email": str(payload.payer_email).lower() if payload.payer_email else None,
                "message": payload.message.strip() if payload.message else None,
            }
        )
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Não foi possível registrar o apoio.")
    row = response.data[0]
    background_tasks.add_task(
        send_support_email,
        "Nova intenção de apoio ao Foundy",
        f"Valor em centavos: {payload.amount_cents}\nPagador: {payload.payer_name or 'não informado'}\nE-mail: {payload.payer_email or 'não informado'}\nReferência: {reference}",
    )
    return {
        **row,
        "mensagem": "Recebemos sua intenção de apoio. Conclua manualmente pelo contato oficial.",
        "payment": manual_payment_instructions(payload.amount_cents, reference),
    }


@router.get("/me/support/contributions")
async def list_my_support_contributions(user_id: UUID = Query(...)) -> list[dict]:
    await _ensure_user(user_id)
    response = await (
        get_supabase()
        .table("support_contributions")
        .select("*")
        .eq("user_id", str(user_id))
        .order("created_at", desc=True)
        .limit(80)
        .execute()
    )
    return response.data


@router.get("/admin/support/contributions")
async def list_admin_support_contributions(admin_usuario_id: UUID = Query(...)) -> list[dict]:
    await _ensure_admin(admin_usuario_id)
    response = await get_supabase().table("support_contributions").select("*").order("created_at", desc=True).limit(200).execute()
    return response.data


@router.patch("/admin/support/contributions/{contribution_id}")
async def update_support_contribution(contribution_id: UUID, payload: AdminSupportContributionUpdate) -> dict:
    await _ensure_admin(payload.admin_usuario_id)
    supabase = get_supabase()
    current = await supabase.table("support_contributions").select("*").eq("id", str(contribution_id)).limit(1).execute()
    if not current.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Apoio não encontrado.")
    if payload.status == "confirmed":
        await confirm_support_contribution(supabase, str(contribution_id), payload.admin_usuario_id, payload.admin_notes)
    else:
        await (
            supabase.table("support_contributions")
            .update({"status": payload.status, "admin_notes": payload.admin_notes})
            .eq("id", str(contribution_id))
            .execute()
        )
    if current.data[0].get("user_id"):
        await _notify(current.data[0]["user_id"], "Apoio ao Foundy atualizado", f"Status do apoio: {payload.status}.")
    return {"mensagem": "Apoio atualizado."}


@router.post("/loss-alerts/{alert_id}/boost", status_code=status.HTTP_201_CREATED)
async def create_loss_alert_boost(alert_id: UUID, payload: LossAlertBoostCreate, background_tasks: BackgroundTasks) -> dict:
    await _ensure_user(payload.user_id)
    supabase = get_supabase()
    alert = await supabase.table("alertas_perdidos").select("id,usuario_id,titulo,status").eq("id", str(alert_id)).limit(1).execute()
    if not alert.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alerta de perda não encontrado.")
    alert_row = alert.data[0]
    if alert_row.get("usuario_id") != str(payload.user_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Somente o dono do alerta pode solicitar destaque.")
    if alert_row.get("status") != "ativo":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Apenas alertas ativos podem receber destaque.")

    active = await (
        supabase.table("loss_alert_boosts")
        .select("id,status,ends_at")
        .eq("loss_alert_id", str(alert_id))
        .in_("status", ["pending_payment", "active"])
        .order("created_at", desc=True)
        .limit(5)
        .execute()
    )
    if active.data:
        for boost in active.data:
            if boost.get("status") == "pending_payment":
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Já existe um destaque aguardando confirmação para este alerta.")
            ends_at = boost.get("ends_at")
            if ends_at and datetime.fromisoformat(ends_at.replace("Z", "+00:00")) > datetime.now(timezone.utc):
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Este alerta já tem destaque ativo.")

    plan = boost_price(payload.boost_type)
    reference = manual_reference("BOOST")
    created = await (
        supabase.table("loss_alert_boosts")
        .insert(
            {
                "loss_alert_id": str(alert_id),
                "user_id": str(payload.user_id),
                "boost_type": payload.boost_type,
                "status": "pending_payment",
                "amount_cents": plan["amount_cents"],
                "manual_payment_reference": reference,
            }
        )
        .execute()
    )
    if not created.data:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Não foi possível solicitar o Alerta Ampliado.")
    background_tasks.add_task(
        send_support_email,
        "Novo Alerta Ampliado solicitado",
        f"Alerta: {alert_row.get('titulo')}\nUsuário: {payload.user_id}\nPlano: {payload.boost_type}\nReferência: {reference}",
    )
    return {
        **created.data[0],
        "mensagem": "Alerta Ampliado solicitado. O destaque entra no ar após confirmação manual.",
        "payment": manual_payment_instructions(plan["amount_cents"], reference),
    }


@router.get("/me/loss-alert-boosts")
async def list_my_loss_alert_boosts(user_id: UUID = Query(...)) -> list[dict]:
    await _ensure_user(user_id)
    response = await (
        get_supabase()
        .table("loss_alert_boosts")
        .select("*")
        .eq("user_id", str(user_id))
        .order("created_at", desc=True)
        .limit(80)
        .execute()
    )
    return response.data


@router.get("/admin/loss-alert-boosts")
async def list_admin_loss_alert_boosts(admin_usuario_id: UUID = Query(...)) -> list[dict]:
    await _ensure_admin(admin_usuario_id)
    response = await get_supabase().table("loss_alert_boosts").select("*").order("created_at", desc=True).limit(200).execute()
    return response.data


@router.patch("/admin/loss-alert-boosts/{boost_id}")
async def update_loss_alert_boost(boost_id: UUID, payload: AdminLossAlertBoostUpdate) -> dict:
    await _ensure_admin(payload.admin_usuario_id)
    supabase = get_supabase()
    current = await supabase.table("loss_alert_boosts").select("*").eq("id", str(boost_id)).limit(1).execute()
    if not current.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Destaque não encontrado.")
    boost = current.data[0]
    if payload.status == "active":
        dates = await activate_loss_alert_boost(supabase, boost, payload.admin_usuario_id, payload.admin_notes)
        await _notify(boost.get("user_id"), "Alerta Ampliado ativado", "Seu alerta de perda foi destacado por tempo limitado.", alerta_id=boost.get("loss_alert_id"))
        return {"mensagem": "Alerta Ampliado ativado.", **dates}

    await (
        supabase.table("loss_alert_boosts")
        .update({"status": payload.status, "admin_notes": payload.admin_notes})
        .eq("id", str(boost_id))
        .execute()
    )
    if payload.status in {"cancelled", "expired"}:
        await (
            supabase.table("alertas_perdidos")
            .update({"boost_ativo": False, "boost_expira_em": None, "boost_tipo": None, "atualizado_em": datetime.now(timezone.utc).isoformat()})
            .eq("id", boost["loss_alert_id"])
            .execute()
        )
    await _notify(boost.get("user_id"), "Alerta Ampliado atualizado", f"Status do destaque: {payload.status}.", alerta_id=boost.get("loss_alert_id"))
    return {"mensagem": "Destaque atualizado."}


@router.get("/companies/safe-points/nearby")
async def list_safe_points(q: str | None = Query(default=None, max_length=80)) -> list[dict]:
    query = (
        get_supabase()
        .table("usuarios")
        .select(
            "id,nome,foto_url,empresa_nome,empresa_descricao,empresa_endereco_publico,empresa_cidade,empresa_uf,"
            "empresa_verificada,verified_badge,is_safe_point,safe_point_status,public_slug,public_description,"
            "public_opening_hours,public_address_visible,custom_logo_url"
        )
        .eq("tipo_conta", "empresa")
        .eq("is_safe_point", True)
        .eq("safe_point_status", "active")
        .is_("removido_em", "null")
        .order("empresa_verificada", desc=True)
        .limit(80)
    )
    if q:
        query = query.or_(f"empresa_nome.ilike.%{q}%,empresa_cidade.ilike.%{q}%")
    response = await query.execute()
    return response.data


@router.get("/companies/{company_id}/public-profile")
async def get_company_public_profile(company_id: UUID) -> dict:
    response = await (
        get_supabase()
        .table("usuarios")
        .select(
            "id,nome,tipo_conta,empresa_nome,empresa_descricao,empresa_endereco_publico,empresa_cidade,empresa_uf,"
            "empresa_verificada,empresa_catalogo_publico,verified_badge,is_safe_point,safe_point_status,plan_type,"
            "plan_status,public_slug,public_description,public_whatsapp,public_email,public_opening_hours,"
            "public_address_visible,custom_cover_url,custom_logo_url"
        )
        .eq("id", str(company_id))
        .eq("tipo_conta", "empresa")
        .is_("removido_em", "null")
        .limit(1)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Empresa não encontrada.")
    return response.data[0]


@router.patch("/companies/{company_id}/public-profile")
async def update_company_public_profile(company_id: UUID, payload: CompanyPublicProfileUpdate) -> dict:
    await _ensure_company_owner(company_id, payload.usuario_id)
    updates = payload.model_dump(exclude={"usuario_id"}, exclude_unset=True)
    if "public_email" in updates and updates["public_email"] is not None:
        updates["public_email"] = str(updates["public_email"]).lower()
    if "public_slug" in updates and updates["public_slug"]:
        updates["public_slug"] = _slugify(str(updates["public_slug"]))
    updates["atualizado_em"] = datetime.now(timezone.utc).isoformat()
    await get_supabase().table("usuarios").update(updates).eq("id", str(company_id)).execute()
    return {"mensagem": "Página pública da empresa atualizada."}


@router.get("/companies/{company_id}/reports/summary")
async def get_company_report_summary(company_id: UUID, usuario_id: UUID = Query(...)) -> dict:
    await _ensure_company_owner(company_id, usuario_id)
    response = await (
        get_supabase()
        .table("empresa_catalogo_itens")
        .select("id,status,criado_em,retirado_em")
        .eq("empresa_usuario_id", str(company_id))
        .limit(1000)
        .execute()
    )
    rows = response.data
    total = len(rows)
    retirados = len([row for row in rows if row.get("status") == "retirado"])
    disponiveis = len([row for row in rows if row.get("status") == "disponivel"])
    arquivados = len([row for row in rows if row.get("status") == "arquivado"])
    return {
        "company_id": str(company_id),
        "total_itens": total,
        "total_retirados": retirados,
        "total_disponiveis": disponiveis,
        "total_arquivados": arquivados,
        "taxa_retirada": round((retirados / total) * 100, 1) if total else 0,
        "periodo": "Todos os registros disponíveis",
        "observacao": "Relatório inicial preparado para a Fase 2. Métricas avançadas dependem de eventos de visualização.",
    }


@router.get("/companies/{company_id}/qr-code")
async def get_company_qr_code(company_id: UUID, usuario_id: UUID = Query(...)) -> dict:
    await _ensure_company_owner(company_id, usuario_id)
    company = await get_company_public_profile(company_id)
    slug = company.get("public_slug") or str(company_id)
    url = f"{settings.app_public_url.rstrip('/')}/empresas/{slug}"
    return {
        "url": url,
        "qr_content": url,
        "print_text": "Encontrou ou perdeu algo aqui? Acesse o Foundy.",
    }


@router.get("/companies/{slug}")
async def get_company_by_slug(slug: str) -> dict:
    normalized = _slugify(slug)
    response = await (
        get_supabase()
        .table("usuarios")
        .select(
            "id,nome,foto_url,tipo_conta,empresa_nome,empresa_descricao,empresa_endereco_publico,empresa_cidade,empresa_uf,"
            "empresa_verificada,empresa_catalogo_publico,verified_badge,is_safe_point,safe_point_status,plan_type,"
            "plan_status,public_slug,public_description,public_whatsapp,public_email,public_opening_hours,"
            "public_address_visible,custom_cover_url,custom_logo_url"
        )
        .eq("tipo_conta", "empresa")
        .eq("empresa_catalogo_publico", True)
        .eq("public_slug", normalized)
        .is_("removido_em", "null")
        .limit(1)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Página pública da empresa não encontrada.")
    company = response.data[0]
    catalog = await (
        get_supabase()
        .table("empresa_catalogo_itens")
        .select("id,empresa_usuario_id,titulo,descricao,categoria,subcategoria,codigo_interno,local_armazenamento,imagem_url,status,retirado_por_nome,retirado_em,criado_em,atualizado_em")
        .eq("empresa_usuario_id", company["id"])
        .in_("status", ["disponivel", "retirado"])
        .order("status")
        .order("criado_em", desc=True)
        .limit(200)
        .execute()
    )
    return {**company, "catalogo": catalog.data}
