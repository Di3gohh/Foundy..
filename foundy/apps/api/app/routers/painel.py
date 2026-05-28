from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.core.config import settings
from app.db.supabase_client import get_supabase


router = APIRouter()


def _badge_by_karma(points: int) -> str:
    if points >= 250:
        return "Heroi Local"
    if points >= 100:
        return "Cidadao de Ouro"
    if points >= 25:
        return "Guardiao do Bairro"
    return "Novo Guardiao"


async def _usuario_base(usuario_id: UUID) -> dict:
    supabase = get_supabase()
    response = await (
        supabase.table("usuarios")
        .select(
            "id,nome,nivel_perfil,pontos_luz,foto_url,ocupacao,aceita_notificacoes_email,papel,email,"
            "tipo_conta,empresa_nome,empresa_descricao,empresa_endereco_publico,empresa_cidade,empresa_uf,"
            "empresa_catalogo_publico,banido_ate,banimento_motivo,banido_permanente,chat_banido_ate,"
            "chat_banimento_motivo,chat_banido_permanente"
        )
        .eq("id", str(usuario_id))
        .is_("removido_em", "null")
        .limit(1)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")
    return response.data[0]


async def _listar_chats(usuario_id: UUID) -> list[dict]:
    supabase = get_supabase()
    chats: dict[str, dict] = {}
    for column in ("encontrador_usuario_id", "dono_usuario_id"):
        response = await (
            supabase.table("salas_chat")
            .select("id,item_achado_id,alerta_perdido_id,encontrador_usuario_id,dono_usuario_id,status,criado_em,atualizado_em,origem")
            .eq(column, str(usuario_id))
            .order("atualizado_em", desc=True)
            .limit(50)
            .execute()
        )
        for row in response.data:
            chats[row["id"]] = row

    if not chats:
        return []

    item_ids = list({row["item_achado_id"] for row in chats.values() if row.get("item_achado_id")})
    alerta_ids = list({row["alerta_perdido_id"] for row in chats.values() if row.get("alerta_perdido_id")})
    other_user_ids = list(
        {
            row[column]
            for row in chats.values()
            for column in ("encontrador_usuario_id", "dono_usuario_id")
            if row.get(column) and row.get(column) != str(usuario_id)
        }
    )
    item_titles: dict[str, str] = {}
    if item_ids:
        itens = await supabase.table("itens_achados").select("id,titulo").in_("id", item_ids).execute()
        item_titles = {row["id"]: row["titulo"] for row in itens.data}

    alerta_titles: dict[str, str] = {}
    if alerta_ids:
        alertas = await supabase.table("alertas_perdidos").select("id,titulo").in_("id", alerta_ids).execute()
        alerta_titles = {row["id"]: row["titulo"] for row in alertas.data}

    users_by_id: dict[str, dict] = {}
    if other_user_ids:
        usuarios = await (
            supabase.table("usuarios")
            .select("id,nome,foto_url,ocupacao,nivel_perfil,pontos_luz")
            .in_("id", other_user_ids)
            .execute()
        )
        users_by_id = {row["id"]: row for row in usuarios.data}

    summaries: list[dict] = []
    for row in chats.values():
        other_user_id = (
            row.get("dono_usuario_id")
            if row.get("encontrador_usuario_id") == str(usuario_id)
            else row.get("encontrador_usuario_id")
        )
        other_user = users_by_id.get(other_user_id or "", {})
        last_message = await (
            supabase.table("mensagens_chat")
            .select("mensagem,criado_em,remetente_usuario_id")
            .eq("sala_chat_id", row["id"])
            .order("criado_em", desc=True)
            .limit(1)
            .execute()
        )
        summaries.append(
            {
                "id": row["id"],
                "item_achado_id": row["item_achado_id"],
                "alerta_perdido_id": row.get("alerta_perdido_id"),
                "encontrador_usuario_id": row.get("encontrador_usuario_id"),
                "dono_usuario_id": row.get("dono_usuario_id"),
                "item_titulo": item_titles.get(row.get("item_achado_id") or "", alerta_titles.get(row.get("alerta_perdido_id") or "", "Conversa Foundy")),
                "status": row["status"],
                "criado_em": row["criado_em"],
                "atualizado_em": row["atualizado_em"],
                "ultima_mensagem": last_message.data[0]["mensagem"] if last_message.data else None,
                "ultima_mensagem_em": last_message.data[0]["criado_em"] if last_message.data else None,
                "ultimo_remetente_id": last_message.data[0]["remetente_usuario_id"] if last_message.data else None,
                "outro_usuario_id": other_user_id,
                "outro_usuario_nome": other_user.get("nome"),
                "outro_usuario_foto_url": other_user.get("foto_url"),
                "outro_usuario_ocupacao": other_user.get("ocupacao"),
                "outro_usuario_badge": other_user.get("nivel_perfil"),
                "outro_usuario_pontos_luz": other_user.get("pontos_luz"),
            }
        )

    return sorted(summaries, key=lambda item: item["atualizado_em"], reverse=True)


@router.get("/usuarios/{usuario_id}")
async def painel_usuario(usuario_id: UUID) -> dict:
    supabase = get_supabase()
    usuario = await _usuario_base(usuario_id)
    pontos = int(usuario.get("pontos_luz") or 0)

    itens = await (
        supabase.table("itens_achados")
        .select(
            "id,titulo,descricao,categoria,local_descricao,raio_mascara_metros,imagem_url,status,criado_em,"
            "desafio_pergunta,tags_ia,hashtags,chat_desbloqueado,premium_ativo,premium_expira_em"
        )
        .eq("usuario_id", str(usuario_id))
        .order("criado_em", desc=True)
        .limit(50)
        .execute()
    )

    alertas = await (
        supabase.table("alertas_perdidos")
        .select("id,usuario_id,titulo,descricao,categoria,subcategoria,local_descricao,imagem_url,raio_metros,status,criado_em,atualizado_em")
        .eq("usuario_id", str(usuario_id))
        .order("criado_em", desc=True)
        .limit(50)
        .execute()
    )

    reivindicacoes = await (
        supabase.table("reivindicacoes_item")
        .select("id,item_achado_id,usuario_reivindicante_id,resposta_desafio,status,criado_em")
        .order("criado_em", desc=True)
        .limit(80)
        .execute()
    )
    item_titles = {item["id"]: item["titulo"] for item in itens.data}
    reivindicante_ids = list({row["usuario_reivindicante_id"] for row in reivindicacoes.data if row.get("usuario_reivindicante_id")})
    reivindicantes: dict[str, dict] = {}
    if reivindicante_ids:
        usuarios_reivindicantes = await (
            supabase.table("usuarios")
            .select("id,nome,foto_url,ocupacao,nivel_perfil,pontos_luz")
            .in_("id", reivindicante_ids)
            .execute()
        )
        reivindicantes = {row["id"]: row for row in usuarios_reivindicantes.data}
    reivindicacoes_recebidas = [
        {
            **row,
            "item_titulo": item_titles.get(row["item_achado_id"], "Item encontrado"),
            "usuario_reivindicante_nome": reivindicantes.get(row.get("usuario_reivindicante_id") or "", {}).get("nome"),
            "usuario_reivindicante_foto_url": reivindicantes.get(row.get("usuario_reivindicante_id") or "", {}).get("foto_url"),
            "usuario_reivindicante_ocupacao": reivindicantes.get(row.get("usuario_reivindicante_id") or "", {}).get("ocupacao"),
        }
        for row in reivindicacoes.data
        if row.get("item_achado_id") in item_titles
    ]

    notificacoes = await (
        supabase.table("notificacoes")
        .select("id,tipo,titulo,mensagem,lida_em,criado_em,item_achado_id,alerta_perdido_id,sala_chat_id,reivindicacao_id")
        .eq("usuario_id", str(usuario_id))
        .order("criado_em", desc=True)
        .limit(50)
        .execute()
    )

    return {
        "usuario": {
            "usuario_id": usuario["id"],
            "nome": usuario["nome"],
            "nivel_perfil": usuario.get("nivel_perfil") or _badge_by_karma(pontos),
            "pontos_luz": str(pontos),
            "badge_publica": _badge_by_karma(pontos),
            "email": usuario.get("email") or "",
            "foto_url": usuario.get("foto_url") or "",
            "ocupacao": usuario.get("ocupacao") or "",
            "aceita_notificacoes_email": str(bool(usuario.get("aceita_notificacoes_email", True))).lower(),
            "is_admin": str((usuario.get("email") or "").lower() in settings.admin_emails).lower(),
            "tipo_conta": usuario.get("tipo_conta") or "pessoal",
            "empresa_nome": usuario.get("empresa_nome") or "",
            "empresa_descricao": usuario.get("empresa_descricao") or "",
            "empresa_endereco_publico": usuario.get("empresa_endereco_publico") or "",
            "empresa_cidade": usuario.get("empresa_cidade") or "",
            "empresa_uf": usuario.get("empresa_uf") or "",
            "empresa_catalogo_publico": str(bool(usuario.get("empresa_catalogo_publico", True))).lower(),
            "banido_permanente": str(bool(usuario.get("banido_permanente", False))).lower(),
            "banido_ate": usuario.get("banido_ate") or "",
            "banimento_motivo": usuario.get("banimento_motivo") or "",
            "chat_banido_permanente": str(bool(usuario.get("chat_banido_permanente", False))).lower(),
            "chat_banido_ate": usuario.get("chat_banido_ate") or "",
            "chat_banimento_motivo": usuario.get("chat_banimento_motivo") or "",
        },
        "itens_postados": [
            {
                **item,
                "latitude_aproximada": -23.55052,
                "longitude_aproximada": -46.633308,
                "distancia_metros": None,
                "hashtags_ia": item.get("hashtags") or item.get("tags_ia") or [],
            }
            for item in itens.data
        ],
        "alertas_perdidos": alertas.data,
        "chats": await _listar_chats(usuario_id),
        "reivindicacoes_recebidas": reivindicacoes_recebidas,
        "notificacoes": notificacoes.data,
    }
