from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.pool import close_db, connect_to_db
from app.db.supabase_client import close_supabase, init_supabase
from app.routers import auth, chat, itens_achados, items, karma, notificacoes, processamento, usuarios


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_supabase(settings.supabase_url, settings.supabase_key)
    if settings.database_url:
        await connect_to_db(settings.database_url)
    yield
    await close_db()
    await close_supabase()


app = FastAPI(
    title="Foundy API",
    description="API privada da plataforma Foundy.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["Autenticação"])
app.include_router(usuarios.router, prefix="/usuarios", tags=["Usuários"])
app.include_router(items.router, prefix="/items", tags=["Itens"])
app.include_router(chat.router, prefix="/chat", tags=["Chat Seguro"])
app.include_router(itens_achados.router, prefix="/itens-achados", tags=["Itens Achados"])
app.include_router(notificacoes.router, prefix="/notificacoes", tags=["Notificações"])
app.include_router(processamento.router, prefix="/processamento", tags=["Processamento de Imagem"])
app.include_router(karma.router, prefix="/karma", tags=["Pontos de Luz"])


@app.get("/health", tags=["Sistema"])
async def health_check() -> dict[str, str]:
    return {"status": "ok", "mensagem": "Foundy API operacional"}
