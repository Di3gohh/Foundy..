from datetime import datetime, timedelta, timezone
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.core.config import settings
from app.db.supabase_client import get_supabase


router = APIRouter()


class AdminAction(BaseModel):
    admin_usuario_id: UUID
    motivo: str = Field(min_length=5, max_length=700)
    denuncia_id: UUID | None = None
    denuncia_tipo: Literal["chat", "post"] | None = None


class BanimentoAction(AdminAction):
    dias: int | None = Field(default=None, ge=1, le=3650)
    permanente: bool = False
    tipo: Literal["conta", "chat"] = "conta"


class ResolverDenunciaAction(AdminAction):
    denuncia_tipo: Literal["chat", "post"]


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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Administrador não encontrado.")
    usuario = response.data[0]
    if usuario.get("email", "").lower() not in settings.admin_emails:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso administrativo negado.")
    return usuario


def _is_active_ban(usuario: dict) -> bool:
    if usuario.get("banido_permanente") or usuario.get("chat_banido_permanente"):
        return True
    now = datetime.now(timezone.utc)
    for field in ("banido_ate", "chat_banido_ate"):
        value = usuario.get(field)
        if not value:
            continue
        normalized = value.replace(" ", "T").replace("Z", "+00:00")
        if normalized.endswith("+00"):
            normalized = f"{normalized}:00"
        if datetime.fromisoformat(normalized) > now:
            return True
    return False


async def _notificar(usuario_id: str | None, titulo: str, mensagem: str) -> None:
    if not usuario_id:
        return
    await (
        get_supabase()
        .table("notificacoes")
        .insert({"usuario_id": usuario_id, "tipo": "sistema", "titulo": titulo, "mensagem": mensagem})
        .execute()
    )


async def _registrar_evento(tipo: str, alvo_tipo: str, alvo_id: str, admin_usuario_id: UUID, motivo: str) -> None:
    await (
        get_supabase()
        .table("moderacao_eventos")
        .insert(
            {
                "tipo": tipo,
                "alvo_tipo": alvo_tipo,
                "alvo_id": alvo_id,
                "admin_usuario_id": str(admin_usuario_id),
                "motivo": motivo.strip(),
            }
        )
        .execute()
    )


async def _resolver_denuncia(payload: AdminAction, status_denuncia: str, decisao: str) -> str | None:
    if not payload.denuncia_id or not payload.denuncia_tipo:
        return None
    table = "denuncias_extorsao" if payload.denuncia_tipo == "chat" else "denuncias_posts"
    if table == "denuncias_extorsao" and status_denuncia in {"avisado", "banido", "resolvido"}:
        status_denuncia = "resolvida"
    response = await (
        get_supabase()
        .table(table)
        .update(
            {
                "status": status_denuncia,
                "decisao_admin": decisao,
                "decidido_em": datetime.now(timezone.utc).isoformat(),
                "admin_usuario_id": str(payload.admin_usuario_id),
            }
        )
        .eq("id", str(payload.denuncia_id))
        .select("usuario_denunciante_id")
        .execute()
    )
    if response.data:
        return response.data[0].get("usuario_denunciante_id")
    return None


def _attach_user(row: dict, users_by_id: dict[str, dict], prefix: str, user_id: str | None) -> dict:
    user = users_by_id.get(user_id or "", {})
    return {
        **row,
        f"{prefix}_nome": user.get("nome"),
        f"{prefix}_email": user.get("email"),
        f"{prefix}_foto_url": user.get("foto_url"),
        f"{prefix}_ocupacao": user.get("ocupacao"),
    }


@router.get("/painel")
async def painel_admin(admin_usuario_id: UUID) -> dict:
    await _ensure_admin(admin_usuario_id)
    supabase = get_supabase()

    usuarios = await (
        supabase.table("usuarios")
        .select(
            "id,nome,email,pontos_luz,nivel_perfil,foto_url,ocupacao,tipo_conta,empresa_nome,empresa_descricao,"
            "empresa_endereco_publico,empresa_cidade,empresa_uf,empresa_verificada,empresa_catalogo_publico,"
            "banido_ate,banimento_motivo,banimento_tipo,banido_permanente,chat_banido_ate,chat_banimento_motivo,"
            "chat_banido_permanente,ultimo_post_em,ultimo_aviso_moderacao,ultimo_aviso_em,criado_em,atualizado_em,"
            "empresa_cnpj,empresa_cep,empresa_verificacao_status,ultimo_ip_hash"
        )
        .is_("removido_em", "null")
        .order("criado_em", desc=True)
        .limit(300)
        .execute()
    )
    itens = await (
        supabase.table("itens_achados")
        .select(
            "id,usuario_id,titulo,descricao,categoria,subcategoria,local_descricao,imagem_url,status,criado_em,"
            "atualizado_em,desafio_pergunta,raio_mascara_metros,premium_ativo,premium_expira_em"
        )
        .order("criado_em", desc=True)
        .limit(300)
        .execute()
    )
    alertas = await (
        supabase.table("alertas_perdidos")
        .select("id,usuario_id,titulo,descricao,categoria,subcategoria,local_descricao,imagem_url,raio_metros,status,criado_em,atualizado_em")
        .order("criado_em", desc=True)
        .limit(300)
        .execute()
    )
    moderacao = await (
        supabase.table("moderacao_eventos")
        .select("id,tipo,alvo_tipo,alvo_id,motivo,criado_em,admin_usuario_id")
        .order("criado_em", desc=True)
        .limit(200)
        .execute()
    )
    denuncias_chat = await (
        supabase.table("denuncias_extorsao")
        .select(
            "id,sala_chat_id,item_achado_id,usuario_denunciante_id,usuario_denunciado_id,mensagem_chat_id,"
            "motivo,prova_descricao,prova_arquivo_nome,status,decisao_admin,criado_em,decidido_em"
        )
        .order("criado_em", desc=True)
        .limit(200)
        .execute()
    )
    denuncias_posts = await (
        supabase.table("denuncias_posts")
        .select(
            "id,item_achado_id,alerta_perdido_id,usuario_denunciante_id,usuario_denunciado_id,motivo_tipo,"
            "motivo,status,decisao_admin,criado_em,decidido_em"
        )
        .order("criado_em", desc=True)
        .limit(200)
        .execute()
    )

    users_by_id = {row["id"]: row for row in usuarios.data}
    itens_by_user: dict[str, list[dict]] = {}
    for item in itens.data:
        itens_by_user.setdefault(item.get("usuario_id") or "", []).append(item)

    alertas_by_user: dict[str, list[dict]] = {}
    for alerta in alertas.data:
        alertas_by_user.setdefault(alerta.get("usuario_id") or "", []).append(alerta)

    usuarios_enriquecidos = []
    for usuario in usuarios.data:
        user_items = itens_by_user.get(usuario["id"], [])
        user_alerts = alertas_by_user.get(usuario["id"], [])
        usuarios_enriquecidos.append(
            {
                **usuario,
                "total_itens_postados": len(user_items),
                "total_alertas_perdidos": len(user_alerts),
                "itens_postados": user_items[:20],
                "alertas_perdidos": user_alerts[:20],
                "banimento_ativo": _is_active_ban(usuario),
            }
        )

    item_titles = {row["id"]: row.get("titulo") for row in itens.data}
    alerta_titles = {row["id"]: row.get("titulo") for row in alertas.data}
    itens_enriquecidos = [_attach_user(item, users_by_id, "usuario", item.get("usuario_id")) for item in itens.data]
    alertas_enriquecidos = [_attach_user(alerta, users_by_id, "usuario", alerta.get("usuario_id")) for alerta in alertas.data]

    denuncias_chat_enriquecidas = []
    for denuncia in denuncias_chat.data:
        row = _attach_user(denuncia, users_by_id, "denunciante", denuncia.get("usuario_denunciante_id"))
        row = _attach_user(row, users_by_id, "denunciado", denuncia.get("usuario_denunciado_id"))
        row["item_titulo"] = item_titles.get(denuncia.get("item_achado_id"), "Item não identificado")
        denuncias_chat_enriquecidas.append(row)

    denuncias_posts_enriquecidas = []
    for denuncia in denuncias_posts.data:
        row = _attach_user(denuncia, users_by_id, "denunciante", denuncia.get("usuario_denunciante_id"))
        row = _attach_user(row, users_by_id, "denunciado", denuncia.get("usuario_denunciado_id"))
        row["item_titulo"] = item_titles.get(denuncia.get("item_achado_id"))
        row["alerta_titulo"] = alerta_titles.get(denuncia.get("alerta_perdido_id"))
        denuncias_posts_enriquecidas.append(row)

    return {
        "usuarios": [row for row in usuarios_enriquecidos if row.get("tipo_conta") != "empresa"],
        "empresas": [row for row in usuarios_enriquecidos if row.get("tipo_conta") == "empresa"],
        "itens": itens_enriquecidos,
        "alertas_perdidos": alertas_enriquecidos,
        "moderacao": moderacao.data,
        "denuncias": denuncias_chat_enriquecidas,
        "denuncias_posts": denuncias_posts_enriquecidas,
        "banidos": [row for row in usuarios_enriquecidos if row.get("banimento_ativo")],
    }


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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item não encontrado.")

    await _registrar_evento("item_arquivado", "item", str(item_id), payload.admin_usuario_id, payload.motivo)

    usuario_id = item.data[0].get("usuario_id")
    await _notificar(
        usuario_id,
        "Item removido pela moderação",
        f"Seu item '{item.data[0]['titulo']}' foi arquivado. Motivo: {payload.motivo.strip()}",
    )

    denunciante_id = await _resolver_denuncia(payload, "resolvido", "Post arquivado pelo administrador.")
    await _notificar(denunciante_id, "Sua denúncia foi analisada", "A moderação revisou sua denúncia e arquivou o post.")

    return {"mensagem": "Item arquivado e usuário notificado."}


@router.post("/usuarios/{usuario_id}/banir")
async def admin_banir_usuario(usuario_id: UUID, payload: BanimentoAction) -> dict[str, str]:
    await _ensure_admin(payload.admin_usuario_id)
    supabase = get_supabase()
    now_iso = datetime.now(timezone.utc).isoformat()
    banido_ate = None if payload.permanente else datetime.now(timezone.utc) + timedelta(days=payload.dias or 7)

    if payload.tipo == "chat":
        updates = {
            "chat_banido_permanente": payload.permanente,
            "chat_banido_ate": banido_ate.isoformat() if banido_ate else None,
            "chat_banimento_motivo": payload.motivo.strip(),
            "banimento_tipo": "chat",
            "atualizado_em": now_iso,
        }
        titulo = "Chat suspenso pela moderação"
        prazo = "permanentemente" if payload.permanente else f"por {payload.dias or 7} dia(s)"
        evento = "usuario_banido_chat"
    else:
        updates = {
            "banido_permanente": payload.permanente,
            "banido_ate": banido_ate.isoformat() if banido_ate else None,
            "banimento_motivo": payload.motivo.strip(),
            "banimento_tipo": "conta",
            "atualizado_em": now_iso,
        }
        titulo = "Conta suspensa pela moderação"
        prazo = "permanentemente" if payload.permanente else f"por {payload.dias or 7} dia(s)"
        evento = "usuario_banido"

    response = await (
        supabase.table("usuarios")
        .update(updates)
        .eq("id", str(usuario_id))
        .select("id,nome")
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")

    await _registrar_evento(evento, "usuario", str(usuario_id), payload.admin_usuario_id, payload.motivo)
    if payload.tipo == "conta":
        usuario_alvo = await (
            supabase.table("usuarios")
            .select("ultimo_ip_hash")
            .eq("id", str(usuario_id))
            .limit(1)
            .execute()
        )
        ultimo_ip_hash = usuario_alvo.data[0].get("ultimo_ip_hash") if usuario_alvo.data else None
        if ultimo_ip_hash:
            await (
                supabase.table("ips_bloqueados")
                .upsert(
                    {
                        "ip_hash": ultimo_ip_hash,
                        "usuario_id": str(usuario_id),
                        "motivo": payload.motivo.strip(),
                        "banido_ate": banido_ate.isoformat() if banido_ate else None,
                        "permanente": payload.permanente,
                        "admin_usuario_id": str(payload.admin_usuario_id),
                    },
                    on_conflict="ip_hash",
                )
                .execute()
            )
    await _notificar(
        str(usuario_id),
        titulo,
        f"Seu acesso foi suspenso {prazo}. Motivo: {payload.motivo.strip()}",
    )

    denunciante_id = await _resolver_denuncia(payload, "banido", f"Medida aplicada: {titulo.lower()} {prazo}.")
    await _notificar(
        denunciante_id,
        "Sua denúncia gerou uma ação",
        "A moderação analisou sua denúncia e aplicou uma medida de segurança ao usuário denunciado.",
    )

    return {"mensagem": "Medida aplicada e usuários notificados."}


@router.post("/denuncias/{denuncia_id}/resolver")
async def admin_resolver_denuncia(denuncia_id: UUID, payload: ResolverDenunciaAction) -> dict[str, str]:
    await _ensure_admin(payload.admin_usuario_id)
    payload.denuncia_id = denuncia_id
    denunciante_id = await _resolver_denuncia(payload, "resolvido", payload.motivo.strip())
    await _registrar_evento("denuncia_resolvida", payload.denuncia_tipo, str(denuncia_id), payload.admin_usuario_id, payload.motivo)
    await _notificar(
        denunciante_id,
        "Sua denúncia foi analisada",
        f"A moderação concluiu a análise. Decisão: {payload.motivo.strip()}",
    )
    return {"mensagem": "Denúncia marcada como resolvida e denunciante notificado."}


@router.post("/usuarios/{usuario_id}/avisar")
async def admin_avisar_usuario(usuario_id: UUID, payload: AdminAction) -> dict[str, str]:
    await _ensure_admin(payload.admin_usuario_id)
    supabase = get_supabase()
    now_iso = datetime.now(timezone.utc).isoformat()
    response = await (
        supabase.table("usuarios")
        .update(
            {
                "ultimo_aviso_moderacao": payload.motivo.strip(),
                "ultimo_aviso_em": now_iso,
                "atualizado_em": now_iso,
            }
        )
        .eq("id", str(usuario_id))
        .select("id")
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")
    await _registrar_evento("usuario_avisado", "usuario", str(usuario_id), payload.admin_usuario_id, payload.motivo)
    await _notificar(
        str(usuario_id),
        "Aviso de segurança Foundy",
        f"A moderação enviou um aviso: {payload.motivo.strip()} Evite repetir essa conduta para não sofrer suspensão.",
    )
    denunciante_id = await _resolver_denuncia(payload, "avisado", "Usuário denunciado recebeu aviso formal.")
    await _notificar(denunciante_id, "Sua denúncia foi analisada", "A moderação revisou sua denúncia e enviou um aviso ao usuário denunciado.")
    return {"mensagem": "Aviso enviado e registrado."}


@router.post("/usuarios/{usuario_id}/desbanir")
async def admin_desbanir_usuario(usuario_id: UUID, payload: AdminAction) -> dict[str, str]:
    await _ensure_admin(payload.admin_usuario_id)
    supabase = get_supabase()
    response = await (
        supabase.table("usuarios")
        .update(
            {
                "banido_ate": None,
                "banido_permanente": False,
                "banimento_motivo": None,
                "chat_banido_ate": None,
                "chat_banido_permanente": False,
                "chat_banimento_motivo": None,
                "banimento_tipo": None,
                "atualizado_em": datetime.now(timezone.utc).isoformat(),
            }
        )
        .eq("id", str(usuario_id))
        .select("id")
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")
    await _registrar_evento("usuario_desbanido", "usuario", str(usuario_id), payload.admin_usuario_id, payload.motivo)
    await supabase.table("ips_bloqueados").delete().eq("usuario_id", str(usuario_id)).execute()
    await _notificar(str(usuario_id), "Suspensão removida", f"Sua suspensão foi removida. Observação: {payload.motivo.strip()}")
    return {"mensagem": "Usuário desbanido e notificado."}
