from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field
from postgrest.exceptions import APIError

from app.core.geo import validate_coordinates
from app.db.supabase_client import get_supabase


router = APIRouter()


class AlertaPerdidoCreate(BaseModel):
    usuario_id: UUID
    titulo: str = Field(min_length=3, max_length=120)
    descricao: str = Field(min_length=10, max_length=2000)
    hashtags: list[str] = Field(default_factory=list, max_length=12)
    latitude: float
    longitude: float
    raio_metros: int = Field(default=5000, ge=500, le=50000)


class MarcarNotificacaoLida(BaseModel):
    usuario_id: UUID


class ArquivarAlertaPerdido(BaseModel):
    usuario_id: UUID


def _wkt_point(longitude: float, latitude: float) -> str:
    return f"POINT({longitude} {latitude})"


@router.post("/alertas-perdidos", status_code=status.HTTP_201_CREATED)
async def criar_alerta_perdido(payload: AlertaPerdidoCreate) -> dict[str, str]:
    try:
        validate_coordinates(payload.latitude, payload.longitude)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    supabase = get_supabase()
    try:
        response = await (
            supabase.table("alertas_perdidos")
            .insert(
                {
                    "usuario_id": str(payload.usuario_id),
                    "titulo": payload.titulo.strip(),
                    "descricao": payload.descricao.strip(),
                    "hashtags": [tag.strip().casefold().lstrip("#") for tag in payload.hashtags if tag.strip()],
                    "localizacao_referencia": _wkt_point(payload.longitude, payload.latitude),
                    "raio_metros": payload.raio_metros,
                }
            )
            .select("id")
            .execute()
        )
    except APIError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Nao foi possivel criar o alerta.") from exc

    return {"mensagem": "Alerta perdido criado. Vamos avisar se surgir um item compativel.", "alerta_id": response.data[0]["id"]}


@router.get("")
async def listar_notificacoes(usuario_id: UUID, limite: int = Query(default=20, ge=1, le=100)) -> list[dict]:
    supabase = get_supabase()
    response = await (
        supabase.table("notificacoes")
        .select("id,tipo,titulo,mensagem,lida_em,criado_em,item_achado_id,alerta_perdido_id,sala_chat_id,reivindicacao_id")
        .eq("usuario_id", str(usuario_id))
        .order("criado_em", desc=True)
        .limit(limite)
        .execute()
    )
    return response.data


@router.post("/{notificacao_id}/lida")
async def marcar_lida(notificacao_id: UUID, payload: MarcarNotificacaoLida) -> dict[str, str]:
    supabase = get_supabase()
    response = await (
        supabase.table("notificacoes")
        .update({"lida_em": datetime.now(timezone.utc).isoformat()})
        .eq("id", str(notificacao_id))
        .eq("usuario_id", str(payload.usuario_id))
        .select("id")
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notificacao nao encontrada.")
    return {"mensagem": "Notificacao marcada como lida."}


@router.delete("/alertas-perdidos/{alerta_id}", status_code=status.HTTP_204_NO_CONTENT)
async def arquivar_alerta_perdido(alerta_id: UUID, usuario_id: UUID) -> None:
    supabase = get_supabase()
    response = await (
        supabase.table("alertas_perdidos")
        .update({"status": "arquivado", "atualizado_em": datetime.now(timezone.utc).isoformat()})
        .eq("id", str(alerta_id))
        .eq("usuario_id", str(usuario_id))
        .select("id")
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alerta nao encontrado ou voce nao tem permissao.")
