from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field, HttpUrl
from postgrest.exceptions import APIError

from app.core.config import settings
from app.core.filters import scan_item_text
from app.core.geo import mask_coordinates, validate_coordinates
from app.core.security import hash_password
from app.db.supabase_client import get_supabase


router = APIRouter()

CategoriaItem = Literal["documentos", "eletronicos", "chaves", "vestuario", "outros"]


class ItemAchadoCreate(BaseModel):
    titulo: str = Field(min_length=3, max_length=120)
    descricao: str = Field(min_length=10, max_length=2000)
    categoria: CategoriaItem
    latitude: float
    longitude: float
    local_descricao: str | None = Field(default=None, max_length=160)
    imagem_url: HttpUrl | None = None
    usuario_id: UUID | None = None
    desafio_pergunta: str = Field(min_length=6, max_length=240)
    detalhe_oculto: str = Field(min_length=2, max_length=240)
    tags_ia: list[str] = Field(default_factory=list, max_length=12)


class ItemAchadoUpdate(BaseModel):
    titulo: str | None = Field(default=None, min_length=3, max_length=120)
    descricao: str | None = Field(default=None, min_length=10, max_length=2000)
    categoria: CategoriaItem | None = None
    local_descricao: str | None = Field(default=None, max_length=160)
    imagem_url: HttpUrl | None = None
    status: Literal["publicado", "em_conversa", "devolvido", "arquivado"] | None = None


class ItemAchadoOut(BaseModel):
    id: UUID
    titulo: str
    descricao: str
    categoria: CategoriaItem
    local_descricao: str | None = None
    latitude_aproximada: float
    longitude_aproximada: float
    raio_mascara_metros: int
    distancia_metros: float | None = None
    imagem_url: str | None = None
    status: str
    criado_em: datetime
    desafio_pergunta: str | None = None
    chat_desbloqueado: bool = False
    tags_ia: list[str] = Field(default_factory=list)


class ReivindicacaoCreate(BaseModel):
    usuario_id: UUID | None = None
    resposta_desafio: str = Field(min_length=2, max_length=500)


class ValidacaoReivindicacao(BaseModel):
    aprovada: bool
    observacao: str | None = Field(default=None, max_length=500)


def _wkt_point(longitude: float, latitude: float) -> str:
    return f"POINT({longitude} {latitude})"


def _normalizar_item(row: dict) -> ItemAchadoOut:
    return ItemAchadoOut(
        id=row["id"],
        titulo=row["titulo"],
        descricao=row["descricao"],
        categoria=row["categoria"],
        local_descricao=row.get("local_descricao"),
        latitude_aproximada=float(row["latitude_aproximada"]),
        longitude_aproximada=float(row["longitude_aproximada"]),
        raio_mascara_metros=int(row.get("raio_mascara_metros") or settings.location_mask_radius_meters),
        distancia_metros=float(row["distancia_metros"]) if row.get("distancia_metros") is not None else None,
        imagem_url=row.get("imagem_url"),
        status=row["status"],
        criado_em=row["criado_em"],
        desafio_pergunta=row.get("desafio_pergunta"),
        chat_desbloqueado=bool(row.get("chat_desbloqueado") or False),
        tags_ia=list(row.get("tags_ia") or []),
    )


@router.post("", response_model=ItemAchadoOut, status_code=status.HTTP_201_CREATED)
async def cadastrar_item_achado(payload: ItemAchadoCreate) -> ItemAchadoOut:
    titulo = payload.titulo.strip()
    descricao = payload.descricao.strip()
    local_descricao = payload.local_descricao.strip() if payload.local_descricao else None

    scan = scan_item_text(titulo, descricao)
    if scan.blocked:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=scan.reasons)

    try:
        latitude_aproximada, longitude_aproximada = mask_coordinates(
            payload.latitude,
            payload.longitude,
            settings.location_mask_radius_meters,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    supabase = get_supabase()
    item = {
        "usuario_id": str(payload.usuario_id) if payload.usuario_id else None,
        "titulo": titulo,
        "descricao": descricao,
        "categoria": payload.categoria,
        "local_descricao": local_descricao,
        "localizacao_aproximada": _wkt_point(longitude_aproximada, latitude_aproximada),
        "raio_mascara_metros": settings.location_mask_radius_meters,
        "imagem_url": str(payload.imagem_url) if payload.imagem_url else None,
        "status": "publicado",
        "desafio_pergunta": payload.desafio_pergunta.strip(),
        "detalhe_oculto_hash": hash_password(payload.detalhe_oculto.strip().casefold()),
        "tags_ia": [tag.strip().casefold() for tag in payload.tags_ia if tag.strip()],
    }

    try:
        response = await (
            supabase.table("itens_achados")
            .insert(item)
            .select("id,titulo,descricao,categoria,local_descricao,raio_mascara_metros,imagem_url,status,criado_em,desafio_pergunta,tags_ia")
            .execute()
        )
    except APIError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Não foi possível cadastrar o item.") from exc

    if not response.data:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="O item foi enviado, mas não retornou do banco.")

    created = response.data[0]
    created["latitude_aproximada"] = latitude_aproximada
    created["longitude_aproximada"] = longitude_aproximada
    created["distancia_metros"] = None
    created["chat_desbloqueado"] = False
    return _normalizar_item(created)


@router.get("/proximos", response_model=list[ItemAchadoOut])
async def listar_itens_achados_por_proximidade(
    latitude: float = -23.55052,
    longitude: float = -46.633308,
    raio_metros: Annotated[int, Query(ge=500, le=50_000)] = 8_000,
    limite: Annotated[int, Query(ge=1, le=50)] = 20,
) -> list[ItemAchadoOut]:
    try:
        validate_coordinates(latitude, longitude)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    supabase = get_supabase()
    try:
        response = await supabase.rpc(
            "buscar_itens_achados_por_proximidade",
            {
                "latitude_usuario": latitude,
                "longitude_usuario": longitude,
                "raio_metros": raio_metros,
                "limite_resultados": limite,
            },
        ).execute()
    except APIError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Não foi possível carregar os itens.") from exc

    return [_normalizar_item(row) for row in response.data]


@router.post("/{item_id}/reivindicar", status_code=status.HTTP_201_CREATED)
async def reivindicar_item(item_id: UUID, payload: ReivindicacaoCreate) -> dict[str, str]:
    supabase = get_supabase()
    try:
        response = await (
            supabase.table("reivindicacoes_item")
            .insert(
                {
                    "item_achado_id": str(item_id),
                    "usuario_reivindicante_id": str(payload.usuario_id) if payload.usuario_id else None,
                    "resposta_desafio": payload.resposta_desafio.strip(),
                    "status": "aguardando_validacao",
                }
            )
            .select("id")
            .execute()
        )
    except APIError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Não foi possível iniciar a verificação.") from exc

    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item não encontrado.")

    return {
        "mensagem": "Resposta enviada ao encontrador. O chat será liberado após validação.",
        "reivindicacao_id": response.data[0]["id"],
    }


@router.post("/reivindicacoes/{reivindicacao_id}/validar")
async def validar_reivindicacao(reivindicacao_id: UUID, payload: ValidacaoReivindicacao) -> dict[str, str]:
    supabase = get_supabase()
    status_validacao = "aprovada" if payload.aprovada else "recusada"

    try:
        response = await supabase.rpc(
            "validar_reivindicacao_item",
            {
                "reivindicacao_id_param": str(reivindicacao_id),
                "aprovada_param": payload.aprovada,
                "observacao_param": payload.observacao,
            },
        ).execute()
    except APIError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Não foi possível validar a resposta.") from exc

    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reivindicação não encontrada.")

    return {
        "mensagem": (
            "Resposta validada. Chat seguro liberado."
            if status_validacao == "aprovada"
            else "Resposta recusada. O chat continua bloqueado."
        )
    }


@router.patch("/{item_id}")
async def atualizar_item_achado(item_id: UUID, payload: ItemAchadoUpdate) -> dict[str, str]:
    updates = payload.model_dump(exclude_unset=True)
    if "imagem_url" in updates and updates["imagem_url"] is not None:
        updates["imagem_url"] = str(updates["imagem_url"])

    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Informe ao menos um campo para atualizar.")

    supabase = get_supabase()
    try:
        response = await supabase.table("itens_achados").update(updates).eq("id", str(item_id)).select("id").execute()
    except APIError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Não foi possível atualizar o item.") from exc

    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item não encontrado.")

    return {"mensagem": "Item atualizado com sucesso."}


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def arquivar_item_achado(item_id: UUID) -> None:
    supabase = get_supabase()
    try:
        response = await (
            supabase.table("itens_achados")
            .update({"status": "arquivado"})
            .eq("id", str(item_id))
            .select("id")
            .execute()
        )
    except APIError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Não foi possível arquivar o item.") from exc

    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item não encontrado.")
