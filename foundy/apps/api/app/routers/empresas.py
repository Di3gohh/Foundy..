from datetime import datetime, timezone
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.db.supabase_client import get_supabase
from app.services.billing_service import company_catalog_limit, company_plan_allows, company_plan_name
from app.services.storage_service import store_public_image_if_needed


router = APIRouter()

CatalogCategory = Literal["documentos", "eletronicos", "chaves", "vestuario", "outros"]
CatalogStatus = Literal["disponivel", "retirado", "arquivado"]
DOCUMENT_HINTS = ("rg", "cpf", "cnh", "documento", "identidade", "passaporte", "certidao", "certidão", "carteira de trabalho")


class EmpresaCatalogoItemCreate(BaseModel):
    usuario_id: UUID
    titulo: str = Field(min_length=3, max_length=120)
    descricao: str = Field(min_length=5, max_length=1000)
    categoria: CatalogCategory
    subcategoria: str | None = Field(default=None, max_length=80)
    codigo_interno: str | None = Field(default=None, max_length=80)
    local_armazenamento: str | None = Field(default=None, max_length=160)
    imagem_url: str | None = Field(default=None, max_length=5_000_000)


class EmpresaCatalogoItemUpdate(BaseModel):
    usuario_id: UUID
    status: CatalogStatus
    retirado_por_nome: str | None = Field(default=None, min_length=2, max_length=120)
    retirado_em: datetime | None = None


async def _ensure_empresa_owner(empresa_id: UUID, usuario_id: UUID) -> dict:
    supabase = get_supabase()
    response = await (
        supabase.table("usuarios")
        .select("id,tipo_conta,empresa_nome,empresa_endereco_publico,plan_type,plan_status")
        .eq("id", str(empresa_id))
        .eq("id", str(usuario_id))
        .is_("removido_em", "null")
        .limit(1)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso permitido apenas para a conta empresarial dona do catálogo.")
    empresa = response.data[0]
    if empresa.get("tipo_conta") != "empresa":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Esta conta não é empresarial.")
    return empresa


@router.get("")
async def listar_empresas(q: str | None = Query(default=None, max_length=80)) -> list[dict]:
    supabase = get_supabase()
    query = (
        supabase.table("usuarios")
        .select(
            "id,nome,foto_url,ocupacao,tipo_conta,empresa_nome,empresa_descricao,"
            "empresa_endereco_publico,empresa_cidade,empresa_uf,empresa_verificada,empresa_catalogo_publico,criado_em,"
            "plan_type,plan_status,verified_badge,is_safe_point,safe_point_status,public_slug,public_description,"
            "public_opening_hours,public_address_visible,custom_logo_url,safe_point_latitude,safe_point_longitude,"
            "safe_point_service_days,safe_point_clicks"
        )
        .eq("tipo_conta", "empresa")
        .eq("empresa_catalogo_publico", True)
        .is_("removido_em", "null")
        .order("empresa_verificada", desc=True)
        .order("criado_em", desc=True)
        .limit(80)
    )
    if q:
        query = query.or_(f"empresa_nome.ilike.%{q}%,nome.ilike.%{q}%,empresa_cidade.ilike.%{q}%")
    response = await query.execute()
    return response.data


@router.get("/{empresa_id}/catalogo")
async def listar_catalogo_empresa(empresa_id: UUID, status_item: CatalogStatus | None = Query(default=None)) -> list[dict]:
    supabase = get_supabase()
    query = (
        supabase.table("empresa_catalogo_itens")
        .select("id,empresa_usuario_id,titulo,descricao,categoria,subcategoria,codigo_interno,local_armazenamento,imagem_url,status,retirado_por_nome,retirado_em,criado_em,atualizado_em")
        .eq("empresa_usuario_id", str(empresa_id))
        .order("criado_em", desc=True)
        .limit(200)
    )
    if status_item:
        query = query.eq("status", status_item)
    response = await query.execute()
    return response.data


@router.post("/{empresa_id}/catalogo", status_code=status.HTTP_201_CREATED)
async def criar_item_catalogo(empresa_id: UUID, payload: EmpresaCatalogoItemCreate) -> dict:
    empresa = await _ensure_empresa_owner(empresa_id, payload.usuario_id)
    supabase = get_supabase()
    limite = company_catalog_limit(empresa.get("plan_type"), empresa.get("plan_status"))
    if limite is not None:
        ativos = await (
            supabase.table("empresa_catalogo_itens")
            .select("id", count="exact")
            .eq("empresa_usuario_id", str(empresa_id))
            .eq("status", "disponivel")
            .execute()
        )
        if (ativos.count or 0) >= limite:
            plano = company_plan_name(empresa.get("plan_type"))
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"O plano {plano} permite até {limite} itens ativos no catálogo. "
                    "Arquive ou marque itens como retirados, ou solicite um upgrade empresarial."
                ),
            )
    privacy_text = f"{payload.titulo} {payload.descricao} {payload.subcategoria or ''}".casefold()
    imagem_publica = None if payload.categoria == "documentos" or any(hint in privacy_text for hint in DOCUMENT_HINTS) else payload.imagem_url
    if imagem_publica:
        try:
            imagem_publica = await store_public_image_if_needed(imagem_publica, f"empresas/{empresa_id}")
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    response = await (
        supabase.table("empresa_catalogo_itens")
        .insert(
            {
                "empresa_usuario_id": str(empresa_id),
                "titulo": payload.titulo.strip(),
                "descricao": payload.descricao.strip(),
                "categoria": payload.categoria,
                "subcategoria": payload.subcategoria.strip() if payload.subcategoria else None,
                "codigo_interno": payload.codigo_interno.strip() if payload.codigo_interno else None,
                "local_armazenamento": payload.local_armazenamento.strip() if payload.local_armazenamento else None,
                "imagem_url": imagem_publica,
                "status": "disponivel",
            }
        )
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Não foi possível cadastrar o item no catálogo empresarial.")
    return response.data[0]


@router.patch("/catalogo/{item_id}")
async def atualizar_status_catalogo(item_id: UUID, payload: EmpresaCatalogoItemUpdate) -> dict[str, str]:
    supabase = get_supabase()
    item = await (
        supabase.table("empresa_catalogo_itens")
        .select("id,empresa_usuario_id")
        .eq("id", str(item_id))
        .limit(1)
        .execute()
    )
    if not item.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item do catálogo não encontrado.")
    empresa = await _ensure_empresa_owner(UUID(item.data[0]["empresa_usuario_id"]), payload.usuario_id)
    if payload.status in {"retirado", "arquivado"} and not company_plan_allows(empresa.get("plan_type"), empresa.get("plan_status"), "history"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Histórico de retiradas e arquivamentos é exclusivo para Empresa Pro ou Eventos e Instituições.",
        )
    updates = {"status": payload.status, "atualizado_em": datetime.now(timezone.utc).isoformat()}
    if payload.status == "retirado":
        if not payload.retirado_por_nome or not payload.retirado_em:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Informe nome, data e horário de retirada.")
        updates["retirado_por_nome"] = payload.retirado_por_nome.strip()
        updates["retirado_em"] = payload.retirado_em.isoformat()
    await (
        supabase.table("empresa_catalogo_itens")
        .update(updates)
        .eq("id", str(item_id))
        .execute()
    )
    return {"mensagem": "Catálogo empresarial atualizado com sucesso."}
