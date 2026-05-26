from fastapi import HTTPException, status
from supabase import AsyncClient, acreate_client


_supabase: AsyncClient | None = None


async def init_supabase(supabase_url: str | None, supabase_key: str | None) -> None:
    global _supabase

    if not supabase_url or not supabase_key:
        return

    if _supabase is None:
        _supabase = await acreate_client(supabase_url, supabase_key)


def get_supabase() -> AsyncClient:
    if _supabase is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Conexão com o Supabase não configurada.",
        )
    return _supabase


async def close_supabase() -> None:
    global _supabase
    _supabase = None
