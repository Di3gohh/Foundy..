import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field
from postgrest.exceptions import APIError

from app.core.config import settings
from app.core.security import hash_password, verify_password
from app.db.supabase_client import get_supabase
from app.services.email_service import has_resend_settings, has_smtp_settings, send_support_email, send_verification_email
from app.services.billing_service import manual_reference
from app.services.storage_service import store_public_image_if_needed


router = APIRouter()


class UsuarioCadastro(BaseModel):
    nome: str = Field(min_length=2, max_length=80)
    email: EmailStr
    senha: str = Field(min_length=8, max_length=128)
    maior_de_idade: bool = False
    aceitou_termos: bool = False
    aceita_notificacoes_email: bool = True
    tipo_conta: Literal["pessoal", "empresa"] = "pessoal"
    empresa_nome: str | None = Field(default=None, min_length=3, max_length=140)
    empresa_descricao: str | None = Field(default=None, max_length=500)
    empresa_endereco_publico: str | None = Field(default=None, max_length=220)
    empresa_cidade: str | None = Field(default=None, max_length=80)
    empresa_uf: str | None = Field(default=None, min_length=2, max_length=2)
    empresa_catalogo_publico: bool = True
    empresa_cnpj: str | None = Field(default=None, min_length=14, max_length=20)
    empresa_cep: str | None = Field(default=None, min_length=8, max_length=12)
    company_plan_interest: Literal["company_free", "company_verified", "company_pro", "event_plan"] = "company_free"


class UsuarioLogin(BaseModel):
    email: EmailStr
    senha: str = Field(min_length=1, max_length=128)


class ConfirmarEmail(BaseModel):
    token: str = Field(min_length=20, max_length=160)


class UsuarioPerfilUpdate(BaseModel):
    nome: str | None = Field(default=None, min_length=2, max_length=80)
    foto_url: str | None = Field(default=None, max_length=5_000_000)
    ocupacao: str | None = Field(default=None, max_length=120)
    aceita_notificacoes_email: bool | None = None


class HubVerificadoCreate(BaseModel):
    usuario_id: UUID
    nome_instituicao: str = Field(min_length=3, max_length=140)
    tipo_instituicao: str = Field(min_length=3, max_length=60)
    cnpj_mascarado: str = Field(min_length=8, max_length=24)
    cidade: str = Field(min_length=2, max_length=80)
    uf: str = Field(min_length=2, max_length=2)


def _badge_by_karma(points: int) -> str:
    if points >= 250:
        return "Heroi Local"
    if points >= 100:
        return "Cidadao de Ouro"
    if points >= 25:
        return "Guardiao do Bairro"
    return "Novo Guardiao"


def _is_admin(email: str, papel: str | None = None) -> bool:
    return email.lower() in settings.admin_emails


def _session_payload(usuario: dict) -> dict[str, str]:
    pontos = int(usuario.get("pontos_luz") or 0)
    email = usuario.get("email") or ""
    return {
        "mensagem": "Login realizado com sucesso.",
        "usuario_id": str(UUID(usuario["id"])),
        "nome": usuario["nome"],
        "email": email,
        "nivel_perfil": usuario.get("nivel_perfil") or _badge_by_karma(pontos),
        "pontos_luz": str(pontos),
        "badge_publica": _badge_by_karma(pontos),
        "foto_url": usuario.get("foto_url") or "",
        "ocupacao": usuario.get("ocupacao") or "",
        "aceita_notificacoes_email": str(bool(usuario.get("aceita_notificacoes_email", True))).lower(),
        "is_admin": str(_is_admin(email, usuario.get("papel"))).lower(),
        "tipo_conta": usuario.get("tipo_conta") or "pessoal",
        "empresa_catalogo_publico": str(bool(usuario.get("empresa_catalogo_publico", True))).lower(),
        "empresa_nome": usuario.get("empresa_nome") or "",
        "empresa_descricao": usuario.get("empresa_descricao") or "",
        "empresa_endereco_publico": usuario.get("empresa_endereco_publico") or "",
        "empresa_cidade": usuario.get("empresa_cidade") or "",
        "empresa_uf": usuario.get("empresa_uf") or "",
        "plan_type": usuario.get("plan_type") or "free",
        "plan_status": usuario.get("plan_status") or "inactive",
        "verified_badge": str(bool(usuario.get("verified_badge", False))).lower(),
        "is_safe_point": str(bool(usuario.get("is_safe_point", False))).lower(),
        "safe_point_status": usuario.get("safe_point_status") or "none",
        "public_slug": usuario.get("public_slug") or "",
        "banido_permanente": str(bool(usuario.get("banido_permanente", False))).lower(),
        "banido_ate": usuario.get("banido_ate") or "",
        "banimento_motivo": usuario.get("banimento_motivo") or "",
        "chat_banido_permanente": str(bool(usuario.get("chat_banido_permanente", False))).lower(),
        "chat_banido_ate": usuario.get("chat_banido_ate") or "",
        "chat_banimento_motivo": usuario.get("chat_banimento_motivo") or "",
    }


def _future_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    normalized = value.replace(" ", "T").replace("Z", "+00:00")
    if normalized.endswith("+00"):
        normalized = f"{normalized}:00"
    return datetime.fromisoformat(normalized)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.headers.get("x-real-ip") or (request.client.host if request.client else "ip-desconhecido")


def _ip_hash(ip: str) -> str:
    secret = settings.ip_hash_secret or settings.jwt_secret_key
    return hashlib.sha256(f"{secret}:{ip}".encode("utf-8")).hexdigest()


async def _ensure_ip_allowed(request: Request) -> None:
    response = await (
        get_supabase()
        .table("ips_bloqueados")
        .select("motivo,banido_ate,permanente")
        .eq("ip_hash", _ip_hash(_client_ip(request)))
        .limit(1)
        .execute()
    )
    if not response.data:
        return
    block = response.data[0]
    banido_ate = _future_datetime(block.get("banido_ate"))
    if block.get("permanente") or (banido_ate and banido_ate > datetime.now(timezone.utc)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Este acesso foi bloqueado pela moderação. Motivo: {block.get('motivo') or 'violação dos termos.'}",
        )


def _ban_message(usuario: dict) -> str | None:
    if usuario.get("banido_permanente"):
        return f"Conta banida permanentemente. Motivo: {usuario.get('banimento_motivo') or 'violação dos termos.'}"
    banido_ate = _future_datetime(usuario.get("banido_ate"))
    if banido_ate and banido_ate > datetime.now(timezone.utc):
        return f"Conta temporariamente banida até {banido_ate.astimezone(timezone.utc).strftime('%d/%m/%Y')}. Motivo: {usuario.get('banimento_motivo') or 'violação dos termos.'}"
    return None


@router.post("/cadastrar", status_code=status.HTTP_201_CREATED)
async def cadastrar_usuario(payload: UsuarioCadastro, background_tasks: BackgroundTasks, request: Request) -> dict[str, object]:
    await _ensure_ip_allowed(request)
    if not payload.maior_de_idade:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O Foundy é permitido apenas para maiores de 18 anos.",
        )
    if not payload.aceitou_termos:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Leia e aceite os Termos de Uso e a Política de Privacidade para criar sua conta.",
        )
    if payload.tipo_conta == "empresa" and (
        not payload.empresa_nome
        or not payload.empresa_endereco_publico
        or not payload.empresa_cidade
        or not payload.empresa_uf
        or not payload.empresa_cnpj
        or not payload.empresa_cep
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Para conta empresarial, informe nome, CNPJ, CEP, endereço público, cidade e UF da instituição.",
        )

    supabase = get_supabase()
    email_normalizado = payload.email.lower()

    usuario_existente = await (
        supabase.table("usuarios")
        .select("id")
        .eq("email", email_normalizado)
        .is_("removido_em", "null")
        .limit(1)
        .execute()
    )
    if usuario_existente.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este e-mail já está cadastrado. Clique em Entrar ou use outro e-mail.",
        )

    email_configurado = has_smtp_settings() or has_resend_settings()
    token = secrets.token_urlsafe(32) if email_configurado else None
    expira_em = datetime.now(timezone.utc) + timedelta(hours=24) if email_configurado else None
    email_verificado_em = None if email_configurado else datetime.now(timezone.utc).isoformat()
    now_iso = datetime.now(timezone.utc).isoformat()

    try:
        created = await supabase.table("usuarios").insert(
            {
                "nome": payload.nome.strip(),
                "email": email_normalizado,
                "senha_hash": hash_password(payload.senha),
                "email_verificacao_token": token,
                "email_verificacao_expira_em": expira_em.isoformat() if expira_em else None,
                "email_verificado_em": email_verificado_em,
                "nivel_perfil": "Novo Guardiao",
                "pontos_luz": 0,
                "foto_url": None,
                "ocupacao": None,
                "aceita_notificacoes_email": payload.aceita_notificacoes_email,
                "termos_aceitos_em": now_iso,
                "maioridade_confirmada_em": now_iso,
                "papel": "admin" if _is_admin(email_normalizado) else "usuario",
                "tipo_conta": payload.tipo_conta,
                "empresa_nome": payload.empresa_nome.strip() if payload.empresa_nome else None,
                "empresa_descricao": payload.empresa_descricao.strip() if payload.empresa_descricao else None,
                "empresa_endereco_publico": payload.empresa_endereco_publico.strip() if payload.empresa_endereco_publico else None,
                "empresa_cidade": payload.empresa_cidade.strip() if payload.empresa_cidade else None,
                "empresa_uf": payload.empresa_uf.strip().upper() if payload.empresa_uf else None,
                "empresa_cnpj": payload.empresa_cnpj.strip() if payload.empresa_cnpj else None,
                "empresa_cep": payload.empresa_cep.strip() if payload.empresa_cep else None,
                "empresa_verificacao_status": "pendente" if payload.tipo_conta == "empresa" else None,
                "empresa_verificada": False,
                "empresa_catalogo_publico": payload.empresa_catalogo_publico,
                "plan_type": "free",
                "plan_status": "active" if payload.tipo_conta == "empresa" else "inactive",
                "ultimo_ip_hash": _ip_hash(_client_ip(request)),
            }
        ).execute()
    except APIError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Não foi possível cadastrar este e-mail. Verifique se ele já foi usado anteriormente.",
        ) from exc

    novo_usuario_id = created.data[0]["id"] if created.data else None
    if not novo_usuario_id:
        novo_usuario = await (
            supabase.table("usuarios")
            .select("id")
            .eq("email", email_normalizado)
            .is_("removido_em", "null")
            .limit(1)
            .execute()
        )
        novo_usuario_id = novo_usuario.data[0]["id"] if novo_usuario.data else None

    plano_empresa = payload.company_plan_interest if payload.tipo_conta == "empresa" else "company_free"
    if payload.tipo_conta == "empresa" and plano_empresa != "company_free" and novo_usuario_id:
        reference = manual_reference("PLAN")
        await (
            supabase.table("monetization_requests")
            .insert(
                {
                    "user_id": novo_usuario_id,
                    "company_id": novo_usuario_id,
                    "request_type": plano_empresa,
                    "status": "pending",
                    "contact_name": payload.empresa_nome.strip() if payload.empresa_nome else payload.nome.strip(),
                    "contact_email": email_normalizado,
                    "message": "Solicitação criada durante o cadastro empresarial.",
                    "desired_plan": plano_empresa,
                    "admin_notes": f"Referência manual inicial: {reference}",
                }
            )
            .execute()
        )

    if payload.tipo_conta == "empresa":
        background_tasks.add_task(
            send_support_email,
            "Nova solicitação de conta empresarial Foundy",
            (
                "Uma empresa solicitou conta no Foundy.\n\n"
                f"Empresa: {payload.empresa_nome}\n"
                f"Plano de interesse: {plano_empresa}\n"
                f"CNPJ informado: {payload.empresa_cnpj}\n"
                f"CEP informado: {payload.empresa_cep}\n"
                f"Endereço público: {payload.empresa_endereco_publico}\n"
                f"Cidade/UF: {payload.empresa_cidade}/{payload.empresa_uf}\n"
                f"E-mail de acesso: {email_normalizado}\n\n"
                "Analise no painel administrativo antes de liberar como empresa verificada."
            ),
        )

    if email_configurado and token:
        background_tasks.add_task(send_verification_email, email_normalizado, token)
        return {
            "mensagem": "Cadastro criado. Enviamos um e-mail de confirmação.",
            "email_verificado": False,
            "login_liberado": False,
        }

    return {
        "mensagem": (
            "Conta criada e verificada automaticamente para testes, pois o envio de e-mail SMTP ainda não está configurado. "
            "Você já pode entrar e testar os recursos protegidos."
        ),
        "email_verificado": True,
        "login_liberado": True,
    }


@router.post("/confirmar-email")
async def confirmar_email(payload: ConfirmarEmail) -> dict[str, str]:
    supabase = get_supabase()
    response = await (
        supabase.table("usuarios")
        .select("id,email_verificacao_expira_em")
        .eq("email_verificacao_token", payload.token)
        .is_("email_verificado_em", "null")
        .execute()
    )

    if not response.data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token inválido ou já utilizado.")

    usuario = response.data[0]
    expira_em = datetime.fromisoformat(usuario["email_verificacao_expira_em"].replace("Z", "+00:00"))
    if expira_em < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token expirado. Solicite um novo e-mail.")

    await (
        supabase.table("usuarios")
        .update(
            {
                "email_verificado_em": datetime.now(timezone.utc).isoformat(),
                "email_verificacao_token": None,
                "email_verificacao_expira_em": None,
                "atualizado_em": datetime.now(timezone.utc).isoformat(),
            }
        )
        .eq("id", usuario["id"])
        .execute()
    )
    return {"mensagem": "E-mail confirmado com sucesso."}


@router.post("/entrar")
async def entrar(payload: UsuarioLogin, request: Request) -> dict[str, str]:
    await _ensure_ip_allowed(request)
    supabase = get_supabase()
    response = await (
        supabase.table("usuarios")
        .select(
            "id,nome,email,senha_hash,email_verificado_em,nivel_perfil,pontos_luz,"
            "foto_url,ocupacao,aceita_notificacoes_email,papel,banido_ate,banimento_motivo,"
            "banido_permanente,banimento_tipo,chat_banido_ate,chat_banimento_motivo,chat_banido_permanente,"
            "tipo_conta,empresa_nome,empresa_descricao,empresa_endereco_publico,empresa_cidade,empresa_uf,empresa_catalogo_publico,"
            "empresa_cnpj,empresa_cep,empresa_verificacao_status,plan_type,plan_status,verified_badge,is_safe_point,safe_point_status,public_slug"
        )
        .eq("email", payload.email.lower())
        .is_("removido_em", "null")
        .execute()
    )

    if not response.data or not verify_password(payload.senha, response.data[0]["senha_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="E-mail ou senha inválidos.")

    usuario = response.data[0]
    ban_message = _ban_message(usuario)
    if ban_message:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=ban_message)
    if usuario["email_verificado_em"] is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Confirme seu e-mail antes de continuar.")

    await (
        supabase.table("usuarios")
        .update({"ultimo_ip_hash": _ip_hash(_client_ip(request)), "atualizado_em": datetime.now(timezone.utc).isoformat()})
        .eq("id", usuario["id"])
        .execute()
    )
    return _session_payload(usuario)


@router.patch("/{usuario_id}/perfil")
async def atualizar_perfil(usuario_id: UUID, payload: UsuarioPerfilUpdate) -> dict[str, str]:
    updates = payload.model_dump(exclude_unset=True)
    if "nome" in updates and updates["nome"] is not None:
        updates["nome"] = updates["nome"].strip()
    if "ocupacao" in updates and updates["ocupacao"] is not None:
        updates["ocupacao"] = updates["ocupacao"].strip()
    if "foto_url" in updates and updates["foto_url"]:
        try:
            updates["foto_url"] = await store_public_image_if_needed(str(updates["foto_url"]), f"usuarios/{usuario_id}")
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Informe ao menos um dado do perfil.")

    updates["atualizado_em"] = datetime.now(timezone.utc).isoformat()
    supabase = get_supabase()
    existente = await (
        supabase.table("usuarios")
        .select("id")
        .eq("id", str(usuario_id))
        .is_("removido_em", "null")
        .limit(1)
        .execute()
    )
    if not existente.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")

    await (
        supabase.table("usuarios")
        .update(updates)
        .eq("id", str(usuario_id))
        .is_("removido_em", "null")
        .execute()
    )

    refreshed = await (
        supabase.table("usuarios")
        .select(
            "id,nome,email,nivel_perfil,pontos_luz,foto_url,ocupacao,aceita_notificacoes_email,papel,"
            "tipo_conta,empresa_nome,empresa_descricao,empresa_endereco_publico,empresa_cidade,empresa_uf,empresa_catalogo_publico,"
            "plan_type,plan_status,verified_badge,is_safe_point,safe_point_status,public_slug,"
            "banido_ate,banimento_motivo,banido_permanente,chat_banido_ate,chat_banimento_motivo,chat_banido_permanente"
        )
        .eq("id", str(usuario_id))
        .is_("removido_em", "null")
        .limit(1)
        .execute()
    )
    if not refreshed.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")

    result = _session_payload(refreshed.data[0])
    result["mensagem"] = "Perfil atualizado com segurança."
    return result


@router.get("/{usuario_id}/perfil-publico")
async def perfil_publico(usuario_id: UUID) -> dict[str, object]:
    supabase = get_supabase()
    response = await (
        supabase.table("usuarios")
        .select("id,nome,nivel_perfil,pontos_luz,foto_url,ocupacao")
        .eq("id", str(usuario_id))
        .is_("removido_em", "null")
        .limit(1)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")

    usuario = response.data[0]
    pontos = int(usuario.get("pontos_luz") or 0)
    return {
        "usuario_id": usuario["id"],
        "nome": usuario["nome"],
        "pontos_luz": pontos,
        "nivel_perfil": usuario.get("nivel_perfil") or _badge_by_karma(pontos),
        "badge_publica": _badge_by_karma(pontos),
        "foto_url": usuario.get("foto_url"),
        "ocupacao": usuario.get("ocupacao"),
    }


@router.post("/hubs-verificados", status_code=status.HTTP_201_CREATED)
async def criar_hub_verificado(payload: HubVerificadoCreate) -> dict[str, str]:
    supabase = get_supabase()
    usuario = await (
        supabase.table("usuarios")
        .select("id,email_verificado_em")
        .eq("id", str(payload.usuario_id))
        .limit(1)
        .execute()
    )
    if not usuario.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")
    if usuario.data[0].get("email_verificado_em") is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Confirme o e-mail antes de solicitar o hub.")

    response = await (
        supabase.table("hubs_verificados")
        .insert(
            {
                "usuario_id": str(payload.usuario_id),
                "nome_instituicao": payload.nome_instituicao.strip(),
                "tipo_instituicao": payload.tipo_instituicao.strip(),
                "cnpj_mascarado": payload.cnpj_mascarado.strip(),
                "cidade": payload.cidade.strip(),
                "uf": payload.uf.strip().upper(),
                "status_verificacao": "pendente",
            }
        )
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Não foi possível registrar o hub verificado.")

    return {"mensagem": "Solicitação de Hub Verificado recebida.", "hub_id": response.data[0]["id"]}


@router.get("/hubs-verificados/lista")
async def listar_hubs_verificados() -> list[dict]:
    supabase = get_supabase()
    response = await (
        supabase.table("hubs_verificados")
        .select("id,nome_instituicao,tipo_instituicao,cidade,uf,status_verificacao,verificado_em")
        .in_("status_verificacao", ["aprovado", "pendente"])
        .order("criado_em", desc=True)
        .execute()
    )
    return response.data
