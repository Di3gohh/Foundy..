from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from postgrest.exceptions import APIError

from app.db.supabase_client import get_supabase


router = APIRouter()


class ConfirmarDevolucao(BaseModel):
    item_achado_id: UUID
    encontrador_usuario_id: UUID
    dono_usuario_id: UUID | None = None
    nota: int = Field(ge=0, le=10)


def _points_from_rating(nota: int) -> int:
    if nota == 0:
        return -10
    if nota < 5:
        return (nota * 4) - 10
    return 10 + ((nota - 5) * 18)


def _badge_by_karma(points: int) -> str:
    if points >= 250:
        return "Heroi Local"
    if points >= 100:
        return "Cidadao de Ouro"
    if points >= 25:
        return "Guardiao do Bairro"
    return "Novo Guardiao"


@router.post("/confirmar-devolucao")
async def confirmar_devolucao(payload: ConfirmarDevolucao) -> dict[str, object]:
    supabase = get_supabase()
    pontos_delta = _points_from_rating(payload.nota)
    now_iso = datetime.now(timezone.utc).isoformat()

    try:
        item = await (
            supabase.table("itens_achados")
            .select("id,titulo")
            .eq("id", str(payload.item_achado_id))
            .limit(1)
            .execute()
        )
        if not item.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item nao encontrado.")
        await (
            supabase.table("itens_achados")
            .update({"status": "devolvido", "devolvido_em": now_iso, "ultimo_movimento_em": now_iso})
            .eq("id", str(payload.item_achado_id))
            .execute()
        )
    except APIError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Nao foi possivel confirmar a devolucao.") from exc

    await (
        supabase.table("salas_chat")
        .update({"status": "encerrado", "atualizado_em": now_iso})
        .eq("item_achado_id", str(payload.item_achado_id))
        .execute()
    )

    usuario = await (
        supabase.table("usuarios")
        .select("id,pontos_luz")
        .eq("id", str(payload.encontrador_usuario_id))
        .limit(1)
        .execute()
    )
    if not usuario.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Encontrador nao encontrado.")

    pontos_atuais = int(usuario.data[0].get("pontos_luz") or 0)
    novos_pontos = max(0, pontos_atuais + pontos_delta)
    await (
        supabase.table("usuarios")
        .update({"pontos_luz": novos_pontos, "nivel_perfil": _badge_by_karma(novos_pontos), "atualizado_em": now_iso})
        .eq("id", str(payload.encontrador_usuario_id))
        .execute()
    )
    await supabase.table("avaliacoes_devolucao").insert(
        {
            "item_achado_id": str(payload.item_achado_id),
            "encontrador_usuario_id": str(payload.encontrador_usuario_id),
            "dono_usuario_id": str(payload.dono_usuario_id) if payload.dono_usuario_id else None,
            "nota": payload.nota,
            "pontos_delta": pontos_delta,
        }
    ).execute()
    await supabase.table("notificacoes").insert(
        {
            "usuario_id": str(payload.encontrador_usuario_id),
            "tipo": "sistema",
            "titulo": "Pontos de Luz atualizados",
            "mensagem": f"Sua devolucao recebeu nota {payload.nota}/10 e gerou {pontos_delta:+d} pontos.",
            "item_achado_id": str(payload.item_achado_id),
        }
    ).execute()
    if payload.dono_usuario_id:
        await supabase.table("notificacoes").insert(
            {
                "usuario_id": str(payload.dono_usuario_id),
                "tipo": "sistema",
                "titulo": "Obrigado pela avaliacao",
                "mensagem": "Sua avaliacao ajuda a comunidade Foundy a confiar em bons encontradores.",
                "item_achado_id": str(payload.item_achado_id),
            }
        ).execute()

    return {
        "mensagem": "Devolucao confirmada. Pontos de Luz atualizados no perfil do encontrador.",
        "pontos_delta": pontos_delta,
    }
