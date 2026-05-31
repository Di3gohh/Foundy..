from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.db.pool import close_db, connect_to_db
from app.db.supabase_client import close_supabase, init_supabase
from app.routers import admin, empresas, itens_achados, karma, notificacoes, painel, processamento, usuarios

logger = logging.getLogger("foundy.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_supabase(settings.supabase_url, settings.supabase_backend_key)
    if settings.database_url:
        await connect_to_db(settings.database_url)
    yield
    await close_db()
    await close_supabase()


app = FastAPI(
    title="Foundy API",
    description="API privada da plataforma Foundy.",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(usuarios.router, prefix="/usuarios", tags=["Usuarios"])
app.include_router(itens_achados.router, prefix="/itens-achados", tags=["Itens Achados"])
app.include_router(notificacoes.router, prefix="/notificacoes", tags=["Notificacoes"])
app.include_router(processamento.router, prefix="/processamento", tags=["Processamento de Imagem"])
app.include_router(karma.router, prefix="/karma", tags=["Pontos de Luz"])
app.include_router(painel.router, prefix="/painel", tags=["Painel do Usuario"])
app.include_router(admin.router, prefix="/admin", tags=["Administracao"])
app.include_router(empresas.router, prefix="/empresas", tags=["Empresas"])


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Erro nao tratado em %s %s", request.method, request.url.path, exc_info=exc)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "A API do Foundy encontrou uma falha interna. Tente novamente em instantes.",
            "erro_tecnico": exc.__class__.__name__,
        },
    )


@app.get("/health", tags=["Sistema"])
async def health_check() -> dict[str, str]:
    return {"status": "ok", "mensagem": "Foundy API operacional"}
