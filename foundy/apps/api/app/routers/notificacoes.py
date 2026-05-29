from datetime import datetime, timezone
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, status
from pydantic import BaseModel, Field
from postgrest.exceptions import APIError

from app.core.filters import censor_sensitive_text, scan_item_text
from app.core.geo import mask_coordinates
from app.core.geo import validate_coordinates
from app.db.supabase_client import get_supabase
from app.services.email_service import send_notification_email
from app.services.moderation_service import aplicar_moderacao_progressiva
from app.services.storage_service import store_public_image_if_needed


router = APIRouter()
CategoriaItem = Literal["documentos", "eletronicos", "chaves", "vestuario", "outros"]


class AlertaPerdidoCreate(BaseModel):
    usuario_id: UUID
    titulo: str = Field(min_length=3, max_length=120)
    descricao: str = Field(min_length=10, max_length=2000)
    categoria: CategoriaItem = "outros"
    subcategoria: str | None = Field(default=None, max_length=80)
    local_descricao: str | None = Field(default=None, max_length=160)
    imagem_url: str | None = Field(default=None, max_length=5_000_000)
    hashtags: list[str] = Field(default_factory=list, max_length=12)
    latitude: float
    longitude: float
    raio_metros: int = Field(default=5000, ge=500, le=50000)


class MarcarNotificacaoLida(BaseModel):
    usuario_id: UUID


class ArquivarAlertaPerdido(BaseModel):
    usuario_id: UUID


class EncontreiAlertaPerdido(BaseModel):
    usuario_id: UUID


def _wkt_point(longitude: float, latitude: float) -> str:
    return f"POINT({longitude} {latitude})"


async def _buscar_usuario_verificado(usuario_id: UUID) -> dict:
    supabase = get_supabase()
    response = await (
        supabase.table("usuarios")
        .select("id,nome,email,email_verificado_em,banido_ate,banido_permanente,banimento_motivo,chat_banido_ate,chat_banido_permanente,chat_banimento_motivo")
        .eq("id", str(usuario_id))
        .is_("removido_em", "null")
        .limit(1)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")
    usuario = response.data[0]
    if usuario.get("email_verificado_em") is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Confirme seu e-mail para usar recursos protegidos.")
    if usuario.get("banido_permanente") or _is_future(usuario.get("banido_ate")):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Conta suspensa. Motivo: {usuario.get('banimento_motivo') or 'violação dos termos.'}")
    return usuario


def _is_future(value: str | None) -> bool:
    if not value:
        return False
    normalized = value.replace(" ", "T").replace("Z", "+00:00")
    if normalized.endswith("+00"):
        normalized = f"{normalized}:00"
    return datetime.fromisoformat(normalized) > datetime.now(timezone.utc)


def _ensure_chat_allowed(usuario: dict) -> None:
    if usuario.get("chat_banido_permanente") or _is_future(usuario.get("chat_banido_ate")):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Seu acesso ao chat e aos desafios está suspenso. Motivo: {usuario.get('chat_banimento_motivo') or 'violação dos termos.'}",
        )


@router.post("/alertas-perdidos", status_code=status.HTTP_201_CREATED)
async def criar_alerta_perdido(payload: AlertaPerdidoCreate, background_tasks: BackgroundTasks) -> dict[str, str]:
    await _buscar_usuario_verificado(payload.usuario_id)
    try:
        validate_coordinates(payload.latitude, payload.longitude)
        latitude_aproximada, longitude_aproximada = mask_coordinates(payload.latitude, payload.longitude, 500)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    supabase = get_supabase()
    titulo = payload.titulo.strip()
    descricao = payload.descricao.strip()
    imagem_publica = None if payload.categoria == "documentos" else payload.imagem_url
    if imagem_publica:
        try:
            imagem_publica = await store_public_image_if_needed(imagem_publica, f"perdas/{payload.usuario_id}")
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if payload.categoria == "documentos":
        titulo = censor_sensitive_text(titulo)
        descricao = censor_sensitive_text(descricao)
    scan = scan_item_text(titulo, descricao)
    if scan.blocked:
        await aplicar_moderacao_progressiva(
            usuario_id=payload.usuario_id,
            origem="post_alerta_perdido",
            motivos=scan.reasons,
            conteudo_tipo="alerta_perdido",
            conteudo_id=None,
            trecho=f"{titulo}\n{descricao}",
            background_tasks=background_tasks,
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=scan.reasons)
    try:
        response = await (
            supabase.table("alertas_perdidos")
            .insert(
                {
                    "usuario_id": str(payload.usuario_id),
                    "titulo": titulo,
                    "descricao": descricao,
                    "categoria": payload.categoria,
                    "subcategoria": payload.subcategoria.strip() if payload.subcategoria else None,
                    "local_descricao": payload.local_descricao.strip() if payload.local_descricao else None,
                    "imagem_url": str(imagem_publica) if imagem_publica else None,
                    "hashtags": [tag.strip().casefold().lstrip("#") for tag in payload.hashtags if tag.strip()],
                    "localizacao_referencia": _wkt_point(longitude_aproximada, latitude_aproximada),
                    "raio_metros": payload.raio_metros,
                }
            )
            .select("id")
            .execute()
        )
    except APIError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Não foi possível criar o alerta.") from exc

    return {"mensagem": "Alerta de perda criado. Vamos avisar se surgir um item compatível.", "alerta_id": response.data[0]["id"]}


@router.get("/alertas-perdidos/proximos")
async def listar_alertas_perdidos_proximos(
    latitude: float = -23.55052,
    longitude: float = -46.633308,
    raio_metros: Annotated[int, Query(ge=500, le=50_000)] = 8_000,
    limite: Annotated[int, Query(ge=1, le=50)] = 30,
) -> list[dict]:
    try:
      validate_coordinates(latitude, longitude)
    except ValueError as exc:
      raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    supabase = get_supabase()
    try:
        response = await supabase.rpc(
            "buscar_alertas_perdidos_por_proximidade",
            {
                "latitude_usuario": latitude,
                "longitude_usuario": longitude,
                "raio_busca_metros": raio_metros,
                "limite_resultados": limite,
            },
        ).execute()
    except APIError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Não foi possível carregar alertas de perda.") from exc
    return response.data


@router.post("/alertas-perdidos/{alerta_id}/encontrei", status_code=status.HTTP_201_CREATED)
async def abrir_chat_alerta_perdido(alerta_id: UUID, payload: EncontreiAlertaPerdido, background_tasks: BackgroundTasks) -> dict[str, str]:
    usuario = await _buscar_usuario_verificado(payload.usuario_id)
    _ensure_chat_allowed(usuario)
    supabase = get_supabase()
    alerta = await (
        supabase.table("alertas_perdidos")
        .select("id,usuario_id,titulo,status")
        .eq("id", str(alerta_id))
        .limit(1)
        .execute()
    )
    if not alerta.data or alerta.data[0].get("status") != "ativo":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alerta de perda não encontrado ou já arquivado.")
    dono_id = alerta.data[0]["usuario_id"]
    if dono_id == str(payload.usuario_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Você não pode abrir chat consigo mesmo neste alerta.")

    existente = await (
        supabase.table("salas_chat")
        .select("id")
        .eq("alerta_perdido_id", str(alerta_id))
        .eq("encontrador_usuario_id", str(payload.usuario_id))
        .eq("dono_usuario_id", dono_id)
        .neq("status", "encerrado")
        .limit(1)
        .execute()
    )
    if existente.data:
        sala_id = existente.data[0]["id"]
    else:
        criada = await (
            supabase.table("salas_chat")
            .insert(
                {
                    "alerta_perdido_id": str(alerta_id),
                    "encontrador_usuario_id": str(payload.usuario_id),
                    "dono_usuario_id": dono_id,
                    "status": "aberto",
                    "origem": "alerta_perdido",
                    "desbloqueado_em": datetime.now(timezone.utc).isoformat(),
                }
            )
            .select("id")
            .execute()
        )
        if not criada.data:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Não foi possível criar o chat de perda.")
        sala_id = criada.data[0]["id"]

    await (
        supabase.table("notificacoes")
        .insert(
            {
                "usuario_id": dono_id,
                "tipo": "chat",
                "titulo": f"{usuario.get('nome', 'Alguém')} encontrou algo parecido",
                "mensagem": f"{usuario.get('nome', 'Alguém')} abriu um chat sobre o alerta '{alerta.data[0]['titulo']}'.",
                "alerta_perdido_id": str(alerta_id),
                "sala_chat_id": sala_id,
            }
        )
        .execute()
    )
    dono = await supabase.table("usuarios").select("email,aceita_notificacoes_email").eq("id", dono_id).limit(1).execute()
    if dono.data and dono.data[0].get("aceita_notificacoes_email"):
        background_tasks.add_task(
            send_notification_email,
            dono.data[0]["email"],
            "Alguém encontrou algo parecido no Foundy",
            f"Uma pessoa abriu um chat sobre seu alerta '{alerta.data[0]['titulo']}'. Acesse o Foundy para conversar com segurança.",
        )
    return {"mensagem": "Chat aberto com a pessoa que publicou o alerta de perda.", "sala_chat_id": sala_id}


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
        .delete()
        .eq("id", str(notificacao_id))
        .eq("usuario_id", str(payload.usuario_id))
        .select("id")
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notificação não encontrada.")
    return {"mensagem": "Notificação aberta e removida do sininho."}


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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alerta não encontrado ou você não tem permissão.")
