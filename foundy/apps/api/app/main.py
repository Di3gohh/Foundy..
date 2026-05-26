from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.pool import close_db, connect_to_db
from app.routers import auth, chat, items


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_db(settings.database_url)
    yield
    await close_db()


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
app.include_router(items.router, prefix="/items", tags=["Itens"])
app.include_router(chat.router, prefix="/chat", tags=["Chat Seguro"])


@app.get("/health", tags=["Sistema"])
async def health_check() -> dict[str, str]:
    return {"status": "ok", "mensagem": "Foundy API operacional"}
