from datetime import datetime, timedelta, timezone
import secrets
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from postgrest.exceptions import APIError

from app.core.config import settings
from app.core.filters import censor_sensitive_text, scan_chat_message, scan_item_text
from app.core.geo import mask_coordinates, validate_coordinates
from app.core.security import hash_password
from app.db.supabase_client import get_supabase
from app.services.ai_processing import generate_hashtag_descriptors
from app.services.email_service import send_notification_email, send_support_email
from app.services.moderation_service import aplicar_moderacao_progressiva
from app.services.storage_service import store_public_image_if_needed


router = APIRouter()

CategoriaItem = Literal["documentos", "eletronicos", "chaves", "vestuario", "outros"]
StatusItem = Literal["publicado", "em_conversa", "devolvido", "arquivado", "destinado para doação"]
StatusSala = Literal["bloqueado", "aberto", "encerrado", "em_revisao"]


def _normalize_supabase_datetime(value):
    """Supabase/PostgREST can return '+00' offsets, which Pydantic rejects."""
    if not isinstance(value, str):
        return value
    normalized = value.replace(" ", "T")
    if normalized.endswith("+00"):
        normalized = f"{normalized}:00"
    return normalized


class ItemAchadoCreate(BaseModel):
    titulo: str = Field(min_length=3, max_length=120)
    descricao: str = Field(min_length=10, max_length=2000)
    categoria: CategoriaItem
    subcategoria: str | None = Field(default=None, max_length=80)
    latitude: float
    longitude: float
    local_descricao: str | None = Field(default=None, max_length=160)
    imagem_url: str | None = Field(default=None, max_length=5_000_000)
    usuario_id: UUID | None = None
    desafio_pergunta: str = Field(min_length=6, max_length=240)
    detalhe_oculto: str = Field(min_length=2, max_length=240)
    tags_ia: list[str] = Field(default_factory=list, max_length=12)


class ItemAchadoUpdate(BaseModel):
    titulo: str | None = Field(default=None, min_length=3, max_length=120)
    descricao: str | None = Field(default=None, min_length=10, max_length=2000)
    categoria: CategoriaItem | None = None
    local_descricao: str | None = Field(default=None, max_length=160)
    imagem_url: str | None = Field(default=None, max_length=5_000_000)
    status: StatusItem | None = None


class ItemAchadoOut(BaseModel):
    id: UUID
    usuario_id: UUID | None = None
    titulo: str
    descricao: str
    categoria: CategoriaItem
    subcategoria: str | None = None
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
    hashtags_ia: list[str] = Field(default_factory=list)
    premium_ativo: bool = False
    premium_expira_em: datetime | None = None

    @field_validator("criado_em", "premium_expira_em", mode="before")
    @classmethod
    def normalize_datetime(cls, value):
        return _normalize_supabase_datetime(value)


class ReivindicacaoCreate(BaseModel):
    usuario_id: UUID | None = None
    resposta_desafio: str = Field(min_length=2, max_length=500)


class ValidacaoReivindicacao(BaseModel):
    aprovada: bool
    encontrador_usuario_id: UUID
    observacao: str | None = Field(default=None, max_length=500)


class MensagemChatCreate(BaseModel):
    usuario_id: UUID
    mensagem: str = Field(min_length=1, max_length=2000)


class MensagemChatOut(BaseModel):
    id: UUID
    sala_chat_id: UUID | None = None
    item_achado_id: UUID | None = None
    alerta_perdido_id: UUID | None = None
    remetente_usuario_id: UUID | None = None
    destinatario_usuario_id: UUID | None = None
    mensagem: str
    status_moderacao: str
    motivos_moderacao: list[str] = Field(default_factory=list)
    denunciar_extorsao_visivel: bool
    criado_em: datetime

    @field_validator("criado_em", mode="before")
    @classmethod
    def normalize_datetime(cls, value):
        return _normalize_supabase_datetime(value)


class DenunciaExtorsaoCreate(BaseModel):
    usuario_id: UUID
    mensagem_chat_id: UUID | None = None
    motivo: str = Field(min_length=5, max_length=500)
    prova_descricao: str | None = Field(default=None, max_length=1000)
    prova_arquivo_nome: str | None = Field(default=None, max_length=160)


class DenunciaPostCreate(BaseModel):
    usuario_id: UUID
    item_achado_id: UUID | None = None
    alerta_perdido_id: UUID | None = None
    motivo_tipo: str = Field(min_length=3, max_length=80)
    motivo: str = Field(min_length=5, max_length=700)


class LostBoostCheckoutCreate(BaseModel):
    usuario_id: UUID
    valor_centavos: int = Field(default=990, ge=100, le=9900)


class PixCallbackSimulation(BaseModel):
    pix_referencia: str = Field(min_length=8, max_length=160)


def _wkt_point(longitude: float, latitude: float) -> str:
    return f"POINT({longitude} {latitude})"


def _normalize_tokens(values: list[str]) -> list[str]:
    normalized = []
    for value in values:
        cleaned = value.strip().lstrip("#").casefold().replace(" ", "")
        if cleaned and cleaned not in normalized:
            normalized.append(cleaned)
    return normalized[:12]


def _normalize_display_hashtags(values: list[str]) -> list[str]:
    display: list[str] = []
    for value in values:
        cleaned = value.strip()
        if not cleaned:
            continue
        if not cleaned.startswith("#"):
            cleaned = f"#{cleaned}"
        if cleaned not in display:
            display.append(cleaned)
    return display[:12]


def _normalize_reasons(value) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item) for item in value]
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            if isinstance(parsed, list):
                return [str(item) for item in parsed]
        except Exception:
            return [value]
    return [str(value)]


def _normalizar_item(row: dict) -> ItemAchadoOut:
    tags_ia = list(row.get("tags_ia") or [])
    hashtags_raw = list(row.get("hashtags") or row.get("hashtags_ia") or tags_ia)

    return ItemAchadoOut(
        id=row["id"],
        usuario_id=row.get("usuario_id"),
        titulo=row["titulo"],
        descricao=row["descricao"],
        categoria=row["categoria"],
        subcategoria=row.get("subcategoria"),
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
        tags_ia=tags_ia,
        hashtags_ia=_normalize_display_hashtags(hashtags_raw),
        premium_ativo=bool(row.get("premium_ativo") or False),
        premium_expira_em=row.get("premium_expira_em"),
    )


def _is_future(value: str | None) -> bool:
    if not value:
        return False
    normalized = value.replace(" ", "T").replace("Z", "+00:00")
    if normalized.endswith("+00"):
        normalized = f"{normalized}:00"
    return datetime.fromisoformat(normalized) > datetime.now(timezone.utc)


async def _buscar_usuario_verificado(usuario_id: UUID) -> dict:
    supabase = get_supabase()
    response = await (
        supabase.table("usuarios")
        .select(
            "id,nome,email,email_verificado_em,nivel_perfil,pontos_luz,banido_ate,banimento_motivo,"
            "banido_permanente,chat_banido_ate,chat_banimento_motivo,chat_banido_permanente"
        )
        .eq("id", str(usuario_id))
        .is_("removido_em", "null")
        .execute()
    )

    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")

    usuario = response.data[0]
    if usuario.get("email_verificado_em") is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Confirme seu e-mail para publicar, reivindicar e conversar no chat seguro.",
        )
    if usuario.get("banido_permanente") or _is_future(usuario.get("banido_ate")):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Conta suspensa. Motivo: {usuario.get('banimento_motivo') or 'violação dos termos.'}",
        )

    return usuario


def _ensure_chat_allowed(usuario: dict) -> None:
    if usuario.get("chat_banido_permanente") or _is_future(usuario.get("chat_banido_ate")):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Seu acesso ao chat e aos desafios está suspenso. Motivo: {usuario.get('chat_banimento_motivo') or 'violação dos termos.'}",
        )


async def _buscar_sala_e_participacao(sala_chat_id: UUID, usuario_id: UUID) -> dict:
    supabase = get_supabase()
    response = await (
        supabase.table("salas_chat")
        .select("id,item_achado_id,alerta_perdido_id,encontrador_usuario_id,dono_usuario_id,status")
        .eq("id", str(sala_chat_id))
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sala de chat não encontrada.")

    sala = response.data[0]
    participantes = {
        str(sala.get("encontrador_usuario_id")) if sala.get("encontrador_usuario_id") else None,
        str(sala.get("dono_usuario_id")) if sala.get("dono_usuario_id") else None,
    }
    if str(usuario_id) not in participantes:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Você não participa desta sala.")
    return sala


def _chat_snippet(message: str) -> str:
    lines = [line.strip() for line in message.splitlines() if line.strip()]
    snippet = "\n".join(lines[:3]) if lines else message.strip()
    return snippet[:320]


async def _upsert_chat_notification(
    destinatario_id: str,
    remetente_id: UUID,
    sala_chat_id: UUID,
    item_achado_id: str | None,
    message: str,
    alerta_perdido_id: str | None = None,
) -> None:
    supabase = get_supabase()
    remetente = await (
        supabase.table("usuarios")
        .select("nome")
        .eq("id", str(remetente_id))
        .limit(1)
        .execute()
    )
    sender_name = remetente.data[0]["nome"] if remetente.data else "Alguém no Foundy"
    snippet = _chat_snippet(message)
    payload = {
        "titulo": f"Mensagem de {sender_name}",
        "mensagem": f"{sender_name}: {snippet}",
        "item_achado_id": item_achado_id,
        "alerta_perdido_id": alerta_perdido_id,
        "sala_chat_id": str(sala_chat_id),
        "criado_em": datetime.now(timezone.utc).isoformat(),
    }
    existing = await (
        supabase.table("notificacoes")
        .select("id")
        .eq("usuario_id", destinatario_id)
        .eq("tipo", "chat")
        .eq("sala_chat_id", str(sala_chat_id))
        .is_("lida_em", "null")
        .order("criado_em", desc=True)
        .limit(1)
        .execute()
    )
    if existing.data:
        await supabase.table("notificacoes").update(payload).eq("id", existing.data[0]["id"]).execute()
        return
    await (
        supabase.table("notificacoes")
        .insert({"usuario_id": destinatario_id, "tipo": "chat", **payload})
        .execute()
    )


@router.post("", response_model=ItemAchadoOut, status_code=status.HTTP_201_CREATED)
async def cadastrar_item_achado(payload: ItemAchadoCreate, background_tasks: BackgroundTasks) -> ItemAchadoOut:
    if payload.usuario_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Para publicar, faça login com e-mail verificado.",
        )

    await _buscar_usuario_verificado(payload.usuario_id)

    titulo = payload.titulo.strip()
    descricao = payload.descricao.strip()
    local_descricao = payload.local_descricao.strip() if payload.local_descricao else None
    imagem_publica = None if payload.categoria == "documentos" else payload.imagem_url
    if imagem_publica:
        try:
            imagem_publica = await store_public_image_if_needed(imagem_publica, f"itens/{payload.usuario_id}")
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if payload.categoria == "documentos":
        descricao = censor_sensitive_text(descricao)
        titulo = censor_sensitive_text(titulo)

    scan = scan_item_text(titulo, descricao)
    if scan.blocked:
        await aplicar_moderacao_progressiva(
            usuario_id=payload.usuario_id,
            origem="post_item_achado",
            motivos=scan.reasons,
            conteudo_tipo="item_achado",
            conteudo_id=None,
            trecho=f"{titulo}\n{descricao}",
            background_tasks=background_tasks,
        )
        background_tasks.add_task(
            send_support_email,
            "Publicação bloqueada pela moderação Foundy",
            (
                "Uma publicação foi bloqueada automaticamente.\n\n"
                f"Usuário: {payload.usuario_id}\n"
                f"Título: {titulo}\n"
                f"Motivos: {', '.join(scan.reasons)}\n"
            ),
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=scan.reasons)

    try:
        latitude_aproximada, longitude_aproximada = mask_coordinates(
            payload.latitude,
            payload.longitude,
            settings.location_mask_radius_meters,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    hashtags_ia_display = generate_hashtag_descriptors(titulo, descricao, " ".join(payload.tags_ia))
    tokens = _normalize_tokens(hashtags_ia_display + payload.tags_ia)

    supabase = get_supabase()
    item = {
        "usuario_id": str(payload.usuario_id),
        "titulo": titulo,
        "descricao": descricao,
        "categoria": payload.categoria,
        "subcategoria": payload.subcategoria.strip() if payload.subcategoria else None,
        "local_descricao": local_descricao,
        "localizacao_aproximada": _wkt_point(longitude_aproximada, latitude_aproximada),
        "raio_mascara_metros": settings.location_mask_radius_meters,
        "imagem_url": str(imagem_publica) if imagem_publica else None,
        "status": "publicado",
        "desafio_pergunta": payload.desafio_pergunta.strip(),
        "detalhe_oculto_hash": hash_password(payload.detalhe_oculto.strip().casefold()),
        "tags_ia": tokens,
        "hashtags": tokens,
        "ultimo_movimento_em": datetime.now(timezone.utc).isoformat(),
    }

    try:
        response = await (
            supabase.table("itens_achados")
            .insert(item)
            .select(
                "id,usuario_id,titulo,descricao,categoria,subcategoria,local_descricao,raio_mascara_metros,"
                "imagem_url,status,criado_em,desafio_pergunta,tags_ia,hashtags,"
                "chat_desbloqueado,premium_ativo,premium_expira_em"
            )
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
    created["hashtags_ia"] = hashtags_ia_display
    await (
        supabase.table("usuarios")
        .update({"ultimo_post_em": datetime.now(timezone.utc).isoformat()})
        .eq("id", str(payload.usuario_id))
        .execute()
    )
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
    if payload.usuario_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Faça login com e-mail verificado antes de reivindicar um item.",
        )
    usuario = await _buscar_usuario_verificado(payload.usuario_id)
    _ensure_chat_allowed(usuario)

    supabase = get_supabase()
    item = await (
        supabase.table("itens_achados")
        .select("id,titulo,usuario_id,status")
        .eq("id", str(item_id))
        .limit(1)
        .execute()
    )
    if not item.data or item.data[0].get("status") not in {"publicado", "em_conversa"}:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item não encontrado ou indisponível.")
    if item.data[0].get("usuario_id") == str(payload.usuario_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Este item foi publicado por você, então não precisa ser reivindicado.")

    try:
        response = await (
            supabase.table("reivindicacoes_item")
            .insert(
                {
                    "item_achado_id": str(item_id),
                    "usuario_reivindicante_id": str(payload.usuario_id),
                    "resposta_desafio": payload.resposta_desafio.strip(),
                    "status": "aguardando_validacao",
                }
            )
            .select("id,item_achado_id")
            .execute()
        )
    except APIError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Não foi possível iniciar a verificação.") from exc

    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item não encontrado.")

    if item.data and item.data[0].get("usuario_id"):
        await (
            supabase.table("notificacoes")
            .insert(
                {
                    "usuario_id": item.data[0]["usuario_id"],
                    "tipo": "sistema",
                    "titulo": "Alguém respondeu ao desafio oculto",
                    "mensagem": f"Uma pessoa acredita que o item '{item.data[0]['titulo']}' é dela. Confira a resposta.",
                    "item_achado_id": str(item_id),
                    "reivindicacao_id": response.data[0]["id"],
                }
            )
            .execute()
        )

    return {
        "mensagem": "Resposta enviada ao encontrador. O chat será liberado após validação.",
        "reivindicacao_id": response.data[0]["id"],
    }


@router.post("/reivindicacoes/{reivindicacao_id}/validar")
async def validar_reivindicacao(reivindicacao_id: UUID, payload: ValidacaoReivindicacao) -> dict[str, object]:
    usuario = await _buscar_usuario_verificado(payload.encontrador_usuario_id)
    _ensure_chat_allowed(usuario)
    supabase = get_supabase()

    reivindicacao = await (
        supabase.table("reivindicacoes_item")
        .select("id,item_achado_id,usuario_reivindicante_id")
        .eq("id", str(reivindicacao_id))
        .execute()
    )
    if not reivindicacao.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reivindicação não encontrada.")

    item = await (
        supabase.table("itens_achados")
        .select("id,usuario_id,titulo")
        .eq("id", reivindicacao.data[0]["item_achado_id"])
        .execute()
    )
    if not item.data or item.data[0].get("usuario_id") != str(payload.encontrador_usuario_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas quem encontrou o item pode validar esta resposta.",
        )

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

    sala_chat_id: str | None = None
    if payload.aprovada:
        sala = await (
            supabase.table("salas_chat")
            .select("id")
            .eq("reivindicacao_id", str(reivindicacao_id))
            .limit(1)
            .execute()
        )
        if sala.data:
            sala_chat_id = sala.data[0]["id"]
    claimant_id = reivindicacao.data[0].get("usuario_reivindicante_id")
    if claimant_id:
        await (
            supabase.table("notificacoes")
            .insert(
                {
                    "usuario_id": claimant_id,
                    "tipo": "chat" if payload.aprovada else "sistema",
                    "titulo": "Resposta aprovada" if payload.aprovada else "Resposta recusada",
                    "mensagem": (
                        f"Sua resposta para '{item.data[0].get('titulo', 'Item encontrado')}' foi aprovada. O chat seguro foi liberado."
                        if payload.aprovada
                        else f"Sua resposta para '{item.data[0].get('titulo', 'Item encontrado')}' não foi validada pelo publicador."
                    ),
                    "item_achado_id": reivindicacao.data[0]["item_achado_id"],
                    "sala_chat_id": sala_chat_id,
                    "reivindicacao_id": str(reivindicacao_id),
                }
            )
            .execute()
        )

    return {
        "mensagem": (
            "Resposta validada. Chat seguro liberado."
            if payload.aprovada
            else "Resposta recusada. O chat continua bloqueado."
        ),
        "chat_desbloqueado": payload.aprovada,
        "sala_chat_id": sala_chat_id,
    }


@router.get("/salas/{sala_chat_id}/mensagens", response_model=list[MensagemChatOut])
async def listar_mensagens_chat(sala_chat_id: UUID, usuario_id: UUID) -> list[MensagemChatOut]:
    await _buscar_usuario_verificado(usuario_id)
    sala = await _buscar_sala_e_participacao(sala_chat_id, usuario_id)
    supabase = get_supabase()

    response = await (
        supabase.table("mensagens_chat")
        .select(
            "id,sala_chat_id,item_achado_id,alerta_perdido_id,remetente_usuario_id,destinatario_usuario_id,"
            "mensagem,status_moderacao,motivos_moderacao,criado_em"
        )
        .eq("sala_chat_id", str(sala_chat_id))
        .order("criado_em")
        .execute()
    )

    denunciar_extorsao_visivel = sala["status"] == "em_revisao"
    mensagens: list[MensagemChatOut] = []
    for mensagem in response.data:
        flagged = mensagem["status_moderacao"] in {"suspeita_extorsao", "em_revisao"}
        mensagem_payload = {**mensagem, "motivos_moderacao": _normalize_reasons(mensagem.get("motivos_moderacao"))}
        mensagens.append(
            MensagemChatOut(
                **mensagem_payload,
                denunciar_extorsao_visivel=denunciar_extorsao_visivel or flagged,
            )
        )
    return mensagens


@router.post("/salas/{sala_chat_id}/mensagens", response_model=MensagemChatOut, status_code=status.HTTP_201_CREATED)
async def enviar_mensagem_chat(
    sala_chat_id: UUID,
    payload: MensagemChatCreate,
    background_tasks: BackgroundTasks,
) -> MensagemChatOut:
    usuario = await _buscar_usuario_verificado(payload.usuario_id)
    _ensure_chat_allowed(usuario)
    sala = await _buscar_sala_e_participacao(sala_chat_id, payload.usuario_id)
    if sala["status"] == "bloqueado":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="O chat ainda está bloqueado pelo desafio do dono.")
    if sala["status"] == "encerrado":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Este chat já foi encerrado porque a devolução foi concluída.")

    mensagem = payload.mensagem.strip()
    scan = scan_chat_message(mensagem)
    status_moderacao = "suspeita_extorsao" if scan.flagged else "limpa"

    destinatario = (
        sala.get("dono_usuario_id")
        if str(sala.get("encontrador_usuario_id")) == str(payload.usuario_id)
        else sala.get("encontrador_usuario_id")
    )

    supabase = get_supabase()
    response = await (
        supabase.table("mensagens_chat")
        .insert(
            {
                "sala_chat_id": str(sala_chat_id),
                "item_achado_id": sala.get("item_achado_id"),
                "alerta_perdido_id": sala.get("alerta_perdido_id"),
                "remetente_usuario_id": str(payload.usuario_id),
                "destinatario_usuario_id": str(destinatario) if destinatario else None,
                "mensagem": mensagem,
                "status_moderacao": status_moderacao,
                "motivos_moderacao": scan.reasons,
                "bloqueada_por_desafio": False,
            }
        )
        .select(
            "id,sala_chat_id,item_achado_id,alerta_perdido_id,remetente_usuario_id,destinatario_usuario_id,"
            "mensagem,status_moderacao,motivos_moderacao,criado_em"
        )
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Não foi possível persistir a mensagem.")

    await (
        supabase.table("salas_chat")
        .update({"atualizado_em": datetime.now(timezone.utc).isoformat()})
        .eq("id", str(sala_chat_id))
        .execute()
    )
    if destinatario:
        await _upsert_chat_notification(
            str(destinatario),
            payload.usuario_id,
            sala_chat_id,
            sala.get("item_achado_id"),
            mensagem,
            sala.get("alerta_perdido_id"),
        )
        destinatario_email = await (
            supabase.table("usuarios")
            .select("email,aceita_notificacoes_email")
            .eq("id", str(destinatario))
            .limit(1)
            .execute()
        )
        if destinatario_email.data and destinatario_email.data[0].get("aceita_notificacoes_email"):
            background_tasks.add_task(
                send_notification_email,
                destinatario_email.data[0]["email"],
                "Nova mensagem no Foundy",
                "Você recebeu uma nova mensagem no chat seguro do Foundy. Acesse sua conta para responder.",
            )

    if scan.flagged:
        acao_moderacao = await aplicar_moderacao_progressiva(
            usuario_id=payload.usuario_id,
            origem="chat",
            motivos=scan.reasons,
            conteudo_tipo="mensagem_chat",
            conteudo_id=response.data[0]["id"],
            trecho=mensagem,
            background_tasks=background_tasks,
        )
        await (
            supabase.table("salas_chat")
            .update({"status": "em_revisao", "atualizado_em": datetime.now(timezone.utc).isoformat()})
            .eq("id", str(sala_chat_id))
            .execute()
        )
        for participante in [sala.get("encontrador_usuario_id"), sala.get("dono_usuario_id")]:
            if not participante:
                continue
            await (
                supabase.table("notificacoes")
                .insert(
                    {
                        "usuario_id": participante,
                        "tipo": "chat",
                        "titulo": "Possível extorsão detectada",
                        "mensagem": (
                            "Detectamos uma mensagem fora das diretrizes na conversa. "
                            "Use Perfil e denúncia se você se sentir inseguro. "
                            f"Medida automática aplicada: {acao_moderacao['titulo']}."
                        ),
                        "item_achado_id": sala.get("item_achado_id"),
                        "alerta_perdido_id": sala.get("alerta_perdido_id"),
                        "sala_chat_id": str(sala_chat_id),
                    }
                )
                .execute()
            )

    mensagem_payload = {
        **response.data[0],
        "motivos_moderacao": _normalize_reasons(response.data[0].get("motivos_moderacao")),
    }
    return MensagemChatOut(**mensagem_payload, denunciar_extorsao_visivel=scan.flagged)


@router.post("/salas/{sala_chat_id}/denunciar-extorsao", status_code=status.HTTP_201_CREATED)
async def denunciar_extorsao(
    sala_chat_id: UUID,
    payload: DenunciaExtorsaoCreate,
    background_tasks: BackgroundTasks,
) -> dict[str, str]:
    await _buscar_usuario_verificado(payload.usuario_id)
    sala = await _buscar_sala_e_participacao(sala_chat_id, payload.usuario_id)
    supabase = get_supabase()
    usuario_denunciado_id = (
        sala.get("dono_usuario_id")
        if str(sala.get("encontrador_usuario_id")) == str(payload.usuario_id)
        else sala.get("encontrador_usuario_id")
    )

    await (
        supabase.table("denuncias_extorsao")
        .insert(
            {
                "sala_chat_id": str(sala_chat_id),
                "item_achado_id": sala.get("item_achado_id"),
                "usuario_denunciante_id": str(payload.usuario_id),
                "usuario_denunciado_id": str(usuario_denunciado_id) if usuario_denunciado_id else None,
                "mensagem_chat_id": str(payload.mensagem_chat_id) if payload.mensagem_chat_id else None,
                "motivo": payload.motivo.strip(),
                "prova_descricao": payload.prova_descricao.strip() if payload.prova_descricao else None,
                "prova_arquivo_nome": payload.prova_arquivo_nome.strip() if payload.prova_arquivo_nome else None,
                "status": "pendente",
            }
        )
        .execute()
    )

    await (
        supabase.table("salas_chat")
        .update({"status": "encerrado", "atualizado_em": datetime.now(timezone.utc).isoformat()})
        .eq("id", str(sala_chat_id))
        .execute()
    )

    await (
        supabase.table("notificacoes")
        .insert(
            {
                "usuario_id": str(payload.usuario_id),
                "tipo": "sistema",
                "titulo": "Denúncia registrada",
                "mensagem": "Recebemos sua denúncia, arquivamos este chat e encaminhamos para revisão prioritária.",
                "item_achado_id": sala.get("item_achado_id"),
                "alerta_perdido_id": sala.get("alerta_perdido_id"),
            }
        )
        .execute()
    )
    if usuario_denunciado_id:
        await (
            supabase.table("notificacoes")
            .insert(
                {
                    "usuario_id": str(usuario_denunciado_id),
                    "tipo": "sistema",
                    "titulo": "Chat arquivado por denúncia",
                    "mensagem": "Uma conversa foi arquivada automaticamente por denúncia de segurança e será revisada pelo suporte Foundy.",
                    "item_achado_id": sala.get("item_achado_id"),
                    "alerta_perdido_id": sala.get("alerta_perdido_id"),
                }
            )
            .execute()
        )
    background_tasks.add_task(
        send_support_email,
        "Denúncia de extorsão no Foundy",
        (
            "Uma denúncia de extorsão foi registrada no Foundy.\n\n"
            f"Sala de chat: {sala_chat_id}\n"
            f"Item achado: {sala.get('item_achado_id') or 'não se aplica'}\n"
            f"Alerta perdido: {sala.get('alerta_perdido_id') or 'não se aplica'}\n"
            f"Usuário denunciante: {payload.usuario_id}\n"
            f"Usuário denunciado: {usuario_denunciado_id or 'não identificado'}\n"
            f"Mensagem denunciada: {payload.mensagem_chat_id or 'não informada'}\n"
            f"Motivo informado: {payload.motivo.strip()}\n\n"
            f"Prova/print: {payload.prova_descricao or 'não informado'}\n"
            f"Arquivo: {payload.prova_arquivo_nome or 'não informado'}\n\n"
            "Acesse o painel/Supabase para revisar a sala e aplicar as medidas necessárias."
        ),
    )
    return {
        "mensagem": (
            "Denúncia de extorsão enviada com sucesso. "
            f"Nosso suporte foi avisado em {settings.support_email}."
        )
    }


@router.post("/denunciar-post", status_code=status.HTTP_201_CREATED)
async def denunciar_post(payload: DenunciaPostCreate, background_tasks: BackgroundTasks) -> dict[str, str]:
    await _buscar_usuario_verificado(payload.usuario_id)
    if not payload.item_achado_id and not payload.alerta_perdido_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Informe o post que deseja denunciar.")

    supabase = get_supabase()
    usuario_denunciado_id: str | None = None
    titulo_alvo = "post denunciado"
    if payload.item_achado_id:
        item = await (
            supabase.table("itens_achados")
            .select("id,titulo,usuario_id")
            .eq("id", str(payload.item_achado_id))
            .limit(1)
            .execute()
        )
        if not item.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post não encontrado.")
        usuario_denunciado_id = item.data[0].get("usuario_id")
        titulo_alvo = item.data[0].get("titulo") or titulo_alvo
    if payload.alerta_perdido_id:
        alerta = await (
            supabase.table("alertas_perdidos")
            .select("id,titulo,usuario_id")
            .eq("id", str(payload.alerta_perdido_id))
            .limit(1)
            .execute()
        )
        if not alerta.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alerta de perda não encontrado.")
        usuario_denunciado_id = alerta.data[0].get("usuario_id")
        titulo_alvo = alerta.data[0].get("titulo") or titulo_alvo

    await (
        supabase.table("denuncias_posts")
        .insert(
            {
                "item_achado_id": str(payload.item_achado_id) if payload.item_achado_id else None,
                "alerta_perdido_id": str(payload.alerta_perdido_id) if payload.alerta_perdido_id else None,
                "usuario_denunciante_id": str(payload.usuario_id),
                "usuario_denunciado_id": usuario_denunciado_id,
                "motivo_tipo": payload.motivo_tipo.strip(),
                "motivo": payload.motivo.strip(),
                "status": "pendente",
            }
        )
        .execute()
    )
    await (
        supabase.table("notificacoes")
        .insert(
            {
                "usuario_id": str(payload.usuario_id),
                "tipo": "sistema",
                "titulo": "Denúncia de post registrada",
                "mensagem": "Obrigado por ajudar a manter o Foundy seguro. A moderação vai revisar sua denúncia.",
                "item_achado_id": str(payload.item_achado_id) if payload.item_achado_id else None,
                "alerta_perdido_id": str(payload.alerta_perdido_id) if payload.alerta_perdido_id else None,
            }
        )
        .execute()
    )
    background_tasks.add_task(
        send_support_email,
        "Denúncia de post no Foundy",
        (
            "Uma denúncia de post foi registrada no Foundy.\n\n"
            f"Alvo: {titulo_alvo}\n"
            f"Tipo do motivo: {payload.motivo_tipo.strip()}\n"
            f"Motivo: {payload.motivo.strip()}\n"
            f"Usuário denunciante: {payload.usuario_id}\n"
            f"Usuário denunciado: {usuario_denunciado_id or 'não identificado'}\n"
        ),
    )
    return {"mensagem": "Denúncia enviada. O suporte Foundy foi avisado para revisar o post."}


@router.post("/{item_id}/lost-boost/checkout", status_code=status.HTTP_201_CREATED)
async def criar_checkout_lost_boost(item_id: UUID, payload: LostBoostCheckoutCreate) -> dict[str, str]:
    await _buscar_usuario_verificado(payload.usuario_id)
    supabase = get_supabase()

    item = await (
        supabase.table("itens_achados")
        .select("id,usuario_id")
        .eq("id", str(item_id))
        .limit(1)
        .execute()
    )
    if not item.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item não encontrado.")
    if item.data[0].get("usuario_id") != str(payload.usuario_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas quem publicou o item pode solicitar o Lost Boost.",
        )

    pix_reference = f"foundy-{item_id.hex[:8]}-{secrets.token_hex(4)}"
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)

    await (
        supabase.table("lost_boost_pagamentos")
        .insert(
            {
                "item_achado_id": str(item_id),
                "usuario_id": str(payload.usuario_id),
                "valor_centavos": payload.valor_centavos,
                "pix_referencia": pix_reference,
                "status": "pendente",
                "expira_em": expires_at.isoformat(),
            }
        )
        .execute()
    )

    return {
        "mensagem": "Cobrança PIX simulada criada. Use o callback de teste para confirmar pagamento.",
        "pix_referencia": pix_reference,
        "expira_em": expires_at.isoformat(),
    }


@router.post("/lost-boost/simular-pix-callback")
async def simular_callback_pix(payload: PixCallbackSimulation) -> dict[str, str]:
    supabase = get_supabase()
    pagamento = await (
        supabase.table("lost_boost_pagamentos")
        .select("id,item_achado_id,status")
        .eq("pix_referencia", payload.pix_referencia)
        .limit(1)
        .execute()
    )
    if not pagamento.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Referência PIX não encontrada.")

    registro = pagamento.data[0]
    if registro["status"] == "pago":
        return {"mensagem": "Pagamento já confirmado anteriormente."}

    now_iso = datetime.now(timezone.utc).isoformat()
    premium_until = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()

    await (
        supabase.table("lost_boost_pagamentos")
        .update({"status": "pago", "pago_em": now_iso})
        .eq("id", registro["id"])
        .execute()
    )
    await (
        supabase.table("itens_achados")
        .update({"premium_ativo": True, "premium_expira_em": premium_until, "atualizado_em": now_iso})
        .eq("id", registro["item_achado_id"])
        .execute()
    )

    return {
        "mensagem": "Lost Boost ativado por 3 dias. Seu item foi priorizado no mapa regional.",
        "premium_expira_em": premium_until,
    }


@router.patch("/{item_id}")
async def atualizar_item_achado(item_id: UUID, payload: ItemAchadoUpdate) -> dict[str, str]:
    updates = payload.model_dump(exclude_unset=True)
    if "imagem_url" in updates and updates["imagem_url"] is not None:
        try:
            updates["imagem_url"] = await store_public_image_if_needed(str(updates["imagem_url"]), f"itens/{item_id}")
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Informe ao menos um campo para atualizar.")

    updates["atualizado_em"] = datetime.now(timezone.utc).isoformat()

    supabase = get_supabase()
    try:
        response = await supabase.table("itens_achados").update(updates).eq("id", str(item_id)).select("id").execute()
    except APIError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Não foi possível atualizar o item.") from exc

    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item não encontrado.")

    return {"mensagem": "Item atualizado com sucesso."}


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def arquivar_item_achado(item_id: UUID, usuario_id: UUID) -> None:
    await _buscar_usuario_verificado(usuario_id)
    supabase = get_supabase()
    item = await (
        supabase.table("itens_achados")
        .select("id,usuario_id")
        .eq("id", str(item_id))
        .limit(1)
        .execute()
    )
    if not item.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item não encontrado.")
    if item.data[0].get("usuario_id") != str(usuario_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Você só pode apagar itens publicados por você.")

    try:
        response = await (
            supabase.table("itens_achados")
            .update({"status": "arquivado", "atualizado_em": datetime.now(timezone.utc).isoformat()})
            .eq("id", str(item_id))
            .select("id")
            .execute()
        )
    except APIError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Não foi possível arquivar o item.") from exc

    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item não encontrado.")

    await (
        supabase.table("salas_chat")
        .update({"status": "encerrado", "atualizado_em": datetime.now(timezone.utc).isoformat()})
        .eq("item_achado_id", str(item_id))
        .execute()
    )
