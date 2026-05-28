from uuid import UUID

from fastapi import APIRouter, HTTPException, status

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
        .select("id,nome,nivel_perfil,pontos_luz,foto_url,ocupacao,aceita_notificacoes_email,papel,email")
        .eq("id", str(usuario_id))
        .is_("removido_em", "null")
        .limit(1)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario nao encontrado.")
    return response.data[0]


async def _listar_chats(usuario_id: UUID) -> list[dict]:
    supabase = get_supabase()
    chats: dict[str, dict] = {}
    for column in ("encontrador_usuario_id", "dono_usuario_id"):
        response = await (
            supabase.table("salas_chat")
            .select("id,item_achado_id,encontrador_usuario_id,dono_usuario_id,status,criado_em,atualizado_em")
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
    item_titles: dict[str, str] = {}
    if item_ids:
        itens = await supabase.table("itens_achados").select("id,titulo").in_("id", item_ids).execute()
        item_titles = {row["id"]: row["titulo"] for row in itens.data}

    summaries: list[dict] = []
    for row in chats.values():
        last_message = await (
            supabase.table("mensagens_chat")
            .select("mensagem,criado_em")
            .eq("sala_chat_id", row["id"])
            .order("criado_em", desc=True)
            .limit(1)
            .execute()
        )
        summaries.append(
            {
                "id": row["id"],
                "item_achado_id": row["item_achado_id"],
                "encontrador_usuario_id": row.get("encontrador_usuario_id"),
                "dono_usuario_id": row.get("dono_usuario_id"),
                "item_titulo": item_titles.get(row["item_achado_id"], "Item encontrado"),
                "status": row["status"],
                "criado_em": row["criado_em"],
                "atualizado_em": row["atualizado_em"],
                "ultima_mensagem": last_message.data[0]["mensagem"] if last_message.data else None,
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
        .select("id,titulo,descricao,status,criado_em,atualizado_em")
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
    reivindicacoes_recebidas = [
        {
            **row,
            "item_titulo": item_titles.get(row["item_achado_id"], "Item encontrado"),
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
            "foto_url": usuario.get("foto_url") or "",
            "ocupacao": usuario.get("ocupacao") or "",
            "aceita_notificacoes_email": str(bool(usuario.get("aceita_notificacoes_email", True))).lower(),
            "is_admin": str(usuario.get("papel") == "admin").lower(),
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
