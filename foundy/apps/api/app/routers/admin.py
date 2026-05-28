from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.core.config import settings
from app.db.supabase_client import get_supabase


router = APIRouter()


class AdminAction(BaseModel):
    admin_usuario_id: UUID
    motivo: str = Field(min_length=5, max_length=500)


class BanimentoAction(AdminAction):
    dias: int = Field(ge=1, le=365)


async def _ensure_admin(admin_usuario_id: UUID) -> dict:
    supabase = get_supabase()
    response = await (
        supabase.table("usuarios")
        .select("id,email,papel")
        .eq("id", str(admin_usuario_id))
        .is_("removido_em", "null")
        .limit(1)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Administrador nao encontrado.")
    usuario = response.data[0]
    if usuario.get("email", "").lower() not in settings.admin_emails and usuario.get("papel") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso administrativo negado.")
    return usuario


@router.get("/painel")
async def painel_admin(admin_usuario_id: UUID) -> dict:
    await _ensure_admin(admin_usuario_id)
    supabase = get_supabase()

    usuarios = await (
        supabase.table("usuarios")
        .select("id,nome,email,pontos_luz,nivel_perfil,banido_ate,banimento_motivo,criado_em")
        .order("criado_em", desc=True)
        .limit(100)
        .execute()
    )
    itens = await (
        supabase.table("itens_achados")
        .select("id,titulo,descricao,categoria,local_descricao,imagem_url,status,criado_em")
        .order("criado_em", desc=True)
        .limit(100)
        .execute()
    )
    moderacao = await (
        supabase.table("moderacao_eventos")
        .select("id,tipo,alvo_tipo,alvo_id,motivo,criado_em")
        .order("criado_em", desc=True)
        .limit(100)
        .execute()
    )
    return {"usuarios": usuarios.data, "itens": itens.data, "moderacao": moderacao.data}


@router.post("/itens/{item_id}/arquivar")
async def admin_arquivar_item(item_id: UUID, payload: AdminAction) -> dict[str, str]:
    await _ensure_admin(payload.admin_usuario_id)
    supabase = get_supabase()
    now_iso = datetime.now(timezone.utc).isoformat()

    item = await (
        supabase.table("itens_achados")
        .update({"status": "arquivado", "atualizado_em": now_iso})
        .eq("id", str(item_id))
        .select("id,usuario_id,titulo")
        .execute()
    )
    if not item.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item nao encontrado.")

    await supabase.table("moderacao_eventos").insert(
        {
            "tipo": "item_arquivado",
            "alvo_tipo": "item",
            "alvo_id": str(item_id),
            "admin_usuario_id": str(payload.admin_usuario_id),
            "motivo": payload.motivo.strip(),
        }
    ).execute()

    usuario_id = item.data[0].get("usuario_id")
    if usuario_id:
        await supabase.table("notificacoes").insert(
            {
                "usuario_id": usuario_id,
                "tipo": "sistema",
                "titulo": "Item removido pela moderacao",
                "mensagem": f"Seu item '{item.data[0]['titulo']}' foi arquivado. Motivo: {payload.motivo.strip()}",
                "item_achado_id": str(item_id),
            }
        ).execute()

    return {"mensagem": "Item arquivado e usuario notificado."}


@router.post("/usuarios/{usuario_id}/banir")
async def admin_banir_usuario(usuario_id: UUID, payload: BanimentoAction) -> dict[str, str]:
    await _ensure_admin(payload.admin_usuario_id)
    supabase = get_supabase()
    banido_ate = datetime.now(timezone.utc) + timedelta(days=payload.dias)

    response = await (
        supabase.table("usuarios")
        .update(
            {
                "banido_ate": banido_ate.isoformat(),
                "banimento_motivo": payload.motivo.strip(),
                "atualizado_em": datetime.now(timezone.utc).isoformat(),
            }
        )
        .eq("id", str(usuario_id))
        .select("id,nome")
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario nao encontrado.")

    await supabase.table("moderacao_eventos").insert(
        {
            "tipo": "usuario_banido",
            "alvo_tipo": "usuario",
            "alvo_id": str(usuario_id),
            "admin_usuario_id": str(payload.admin_usuario_id),
            "motivo": payload.motivo.strip(),
        }
    ).execute()
    await supabase.table("notificacoes").insert(
        {
            "usuario_id": str(usuario_id),
            "tipo": "sistema",
            "titulo": "Conta temporariamente banida",
            "mensagem": f"Seu acesso foi suspenso por {payload.dias} dia(s). Motivo: {payload.motivo.strip()}",
        }
    ).execute()

    return {"mensagem": "Usuario banido e notificado."}
