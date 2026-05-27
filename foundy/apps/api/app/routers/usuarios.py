import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from postgrest.exceptions import APIError

from app.core.security import hash_password, verify_password
from app.db.supabase_client import get_supabase
from app.services.email_service import has_smtp_settings, send_verification_email


router = APIRouter()


class UsuarioCadastro(BaseModel):
    nome: str = Field(min_length=2, max_length=80)
    email: EmailStr
    senha: str = Field(min_length=10, max_length=128)


class UsuarioLogin(BaseModel):
    email: EmailStr
    senha: str = Field(min_length=1, max_length=128)


class ConfirmarEmail(BaseModel):
    token: str = Field(min_length=20, max_length=160)


class HubVerificadoCreate(BaseModel):
    usuario_id: UUID
    nome_instituicao: str = Field(min_length=3, max_length=140)
    tipo_instituicao: str = Field(min_length=3, max_length=60)
    cnpj_mascarado: str = Field(min_length=8, max_length=24)
    cidade: str = Field(min_length=2, max_length=80)
    uf: str = Field(min_length=2, max_length=2)


def _badge_by_karma(points: int) -> str:
    if points >= 250:
        return "HerÃ³i Local"
    if points >= 100:
        return "CidadÃ£o de Ouro"
    if points >= 25:
        return "GuardiÃ£o do Bairro"
    return "Novo GuardiÃ£o"


@router.post("/cadastrar", status_code=status.HTTP_201_CREATED)
async def cadastrar_usuario(payload: UsuarioCadastro, background_tasks: BackgroundTasks) -> dict[str, object]:
    supabase = get_supabase()
    smtp_configurado = has_smtp_settings()
    token = secrets.token_urlsafe(32) if smtp_configurado else None
    expira_em = datetime.now(timezone.utc) + timedelta(hours=24) if smtp_configurado else None
    email_verificado_em = None if smtp_configurado else datetime.now(timezone.utc).isoformat()

    try:
        await supabase.table("usuarios").insert(
            {
                "nome": payload.nome.strip(),
                "email": payload.email.lower(),
                "senha_hash": hash_password(payload.senha),
                "email_verificacao_token": token,
                "email_verificacao_expira_em": expira_em.isoformat() if expira_em else None,
                "email_verificado_em": email_verificado_em,
                "nivel_perfil": "Novo GuardiÃ£o",
                "pontos_luz": 0,
            }
        ).execute()
    except APIError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="NÃ£o foi possÃ­vel cadastrar este e-mail.") from exc

    if smtp_configurado and token:
        background_tasks.add_task(send_verification_email, payload.email.lower(), token)
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
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token invÃ¡lido ou jÃ¡ utilizado.")

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
async def entrar(payload: UsuarioLogin) -> dict[str, str]:
    supabase = get_supabase()
    response = await (
        supabase.table("usuarios")
        .select("id,nome,email,senha_hash,email_verificado_em,nivel_perfil,pontos_luz")
        .eq("email", payload.email.lower())
        .is_("removido_em", "null")
        .execute()
    )

    if not response.data or not verify_password(payload.senha, response.data[0]["senha_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="E-mail ou senha invÃ¡lidos.")

    usuario = response.data[0]
    if usuario["email_verificado_em"] is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Confirme seu e-mail antes de continuar.")

    pontos = int(usuario["pontos_luz"] or 0)
    return {
        "mensagem": "Login realizado com sucesso.",
        "usuario_id": str(UUID(usuario["id"])),
        "nome": usuario["nome"],
        "nivel_perfil": usuario["nivel_perfil"],
        "pontos_luz": str(pontos),
        "badge_publica": _badge_by_karma(pontos),
    }


@router.get("/{usuario_id}/perfil-publico")
async def perfil_publico(usuario_id: UUID) -> dict[str, object]:
    supabase = get_supabase()
    response = await (
        supabase.table("usuarios")
        .select("id,nome,nivel_perfil,pontos_luz")
        .eq("id", str(usuario_id))
        .is_("removido_em", "null")
        .limit(1)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="UsuÃ¡rio nÃ£o encontrado.")

    usuario = response.data[0]
    pontos = int(usuario.get("pontos_luz") or 0)
    return {
        "usuario_id": usuario["id"],
        "nome": usuario["nome"],
        "pontos_luz": pontos,
        "nivel_perfil": usuario.get("nivel_perfil") or _badge_by_karma(pontos),
        "badge_publica": _badge_by_karma(pontos),
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="UsuÃ¡rio nÃ£o encontrado.")
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
        .select("id")
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="NÃ£o foi possÃ­vel registrar o hub verificado.")

    return {"mensagem": "SolicitaÃ§Ã£o de Hub Verificado recebida.", "hub_id": response.data[0]["id"]}


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

