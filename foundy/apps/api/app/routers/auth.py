from asyncpg.exceptions import UniqueViolationError
from fastapi import APIRouter, HTTPException, status

from app.core.security import create_access_token, hash_password, verify_password
from app.db.pool import fetch_one
from app.models.schemas import AuthLoginRequest, AuthRegisterRequest, AuthResponse, PublicUser


router = APIRouter()


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: AuthRegisterRequest) -> AuthResponse:
    email = payload.email.lower()
    display_name = payload.display_name.strip()
    if len(display_name) < 2:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Informe um nome válido.")

    password_hash = hash_password(payload.password)

    try:
        row = await fetch_one(
            """
            insert into public.users (email, password_hash, display_name)
            values ($1, $2, $3)
            returning id, display_name
            """,
            email,
            password_hash,
            display_name,
        )
    except UniqueViolationError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Este e-mail já está em uso.")

    token = create_access_token(row["id"])
    return AuthResponse(access_token=token, user=PublicUser(id=row["id"], display_name=row["display_name"]))


@router.post("/login", response_model=AuthResponse)
async def login(payload: AuthLoginRequest) -> AuthResponse:
    row = await fetch_one(
        """
        select id, display_name, password_hash
        from public.users
        where email = $1 and deleted_at is null
        """,
        payload.email.lower(),
    )

    if row is None or not verify_password(payload.password, row["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="E-mail ou senha inválidos.")

    token = create_access_token(row["id"])
    return AuthResponse(access_token=token, user=PublicUser(id=row["id"], display_name=row["display_name"]))
