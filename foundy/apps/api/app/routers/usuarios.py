import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from postgrest.exceptions import APIError

from app.core.security import hash_password, verify_password
from app.db.supabase_client import get_supabase
from app.services.email_service import send_verification_email


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


@router.post("/cadastrar", status_code=status.HTTP_201_CREATED)
async def cadastrar_usuario(payload: UsuarioCadastro, background_tasks: BackgroundTasks) -> dict[str, str]:
    supabase = get_supabase()
    token = secrets.token_urlsafe(32)
    expira_em = datetime.now(timezone.utc) + timedelta(hours=24)

    try:
        await supabase.table("usuarios").insert(
            {
                "nome": payload.nome.strip(),
                "email": payload.email.lower(),
                "senha_hash": hash_password(payload.senha),
                "email_verificacao_token": token,
                "email_verificacao_expira_em": expira_em.isoformat(),
            }
        ).execute()
    except APIError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Não foi possível cadastrar este e-mail.") from exc

    background_tasks.add_task(send_verification_email, payload.email.lower(), token)
    return {"mensagem": "Cadastro criado. Enviamos um e-mail de confirmação."}


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
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="E-mail ou senha inválidos.")

    usuario = response.data[0]
    if usuario["email_verificado_em"] is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Confirme seu e-mail antes de continuar.")

    return {
        "mensagem": "Login realizado com sucesso.",
        "usuario_id": str(UUID(usuario["id"])),
        "nome": usuario["nome"],
        "nivel_perfil": usuario["nivel_perfil"],
        "pontos_luz": str(usuario["pontos_luz"]),
    }
