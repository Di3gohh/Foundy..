from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from postgrest.exceptions import APIError

from app.db.supabase_client import get_supabase


router = APIRouter()


class ConfirmarDevolucao(BaseModel):
    item_achado_id: UUID
    encontrador_usuario_id: UUID
    dono_usuario_id: UUID | None = None


@router.post("/confirmar-devolucao")
async def confirmar_devolucao(payload: ConfirmarDevolucao) -> dict[str, str]:
    supabase = get_supabase()
    try:
        response = await supabase.rpc(
            "confirmar_devolucao_item",
            {
                "item_id": str(payload.item_achado_id),
                "encontrador_id": str(payload.encontrador_usuario_id),
                "dono_id": str(payload.dono_usuario_id) if payload.dono_usuario_id else None,
            },
        ).execute()
    except APIError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Não foi possível confirmar a devolução.") from exc

    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item não encontrado.")

    return {"mensagem": "Devolução confirmada. Pontos de Luz adicionados ao perfil do encontrador."}
