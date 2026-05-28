from datetime import datetime, timezone
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.db.supabase_client import get_supabase


router = APIRouter()

CatalogCategory = Literal["documentos", "eletronicos", "chaves", "vestuario", "outros"]
CatalogStatus = Literal["disponivel", "retirado", "arquivado"]


class EmpresaCatalogoItemCreate(BaseModel):
    usuario_id: UUID
    titulo: str = Field(min_length=3, max_length=120)
    descricao: str = Field(min_length=5, max_length=1000)
    categoria: CatalogCategory
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
        .select("id,tipo_conta,empresa_nome,empresa_endereco_publico")
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
            "empresa_endereco_publico,empresa_cidade,empresa_uf,empresa_verificada,empresa_catalogo_publico,criado_em"
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
        .select("id,empresa_usuario_id,titulo,descricao,categoria,codigo_interno,local_armazenamento,imagem_url,status,retirado_por_nome,retirado_em,criado_em,atualizado_em")
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
    await _ensure_empresa_owner(empresa_id, payload.usuario_id)
    supabase = get_supabase()
    imagem_publica = None if payload.categoria == "documentos" else payload.imagem_url
    response = await (
        supabase.table("empresa_catalogo_itens")
        .insert(
            {
                "empresa_usuario_id": str(empresa_id),
                "titulo": payload.titulo.strip(),
                "descricao": payload.descricao.strip(),
                "categoria": payload.categoria,
                "codigo_interno": payload.codigo_interno.strip() if payload.codigo_interno else None,
                "local_armazenamento": payload.local_armazenamento.strip() if payload.local_armazenamento else None,
                "imagem_url": imagem_publica,
                "status": "disponivel",
            }
        )
        .select("id,empresa_usuario_id,titulo,descricao,categoria,codigo_interno,local_armazenamento,imagem_url,status,retirado_por_nome,retirado_em,criado_em,atualizado_em")
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
    await _ensure_empresa_owner(UUID(item.data[0]["empresa_usuario_id"]), payload.usuario_id)
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
