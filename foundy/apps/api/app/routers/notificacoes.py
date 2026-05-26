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
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Não foi possível criar o alerta.") from exc

    return {"mensagem": "Alerta perdido criado. Vamos avisar se surgir um item compatível.", "alerta_id": response.data[0]["id"]}


@router.get("")
async def listar_notificacoes(usuario_id: UUID, limite: int = Query(default=20, ge=1, le=100)) -> list[dict]:
    supabase = get_supabase()
    response = await (
        supabase.table("notificacoes")
        .select("id,tipo,titulo,mensagem,lida_em,criado_em,item_achado_id,alerta_perdido_id")
        .eq("usuario_id", str(usuario_id))
        .order("criado_em", desc=True)
        .limit(limite)
        .execute()
    )
    return response.data
