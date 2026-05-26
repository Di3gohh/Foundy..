from collections.abc import Sequence

import asyncpg


_pool: asyncpg.Pool | None = None


async def connect_to_db(database_url: str) -> None:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(dsn=database_url, min_size=1, max_size=10)


async def close_db() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("Pool do banco de dados não foi inicializado.")
    return _pool


async def fetch_one(query: str, *args: object) -> asyncpg.Record | None:
    pool = get_pool()
    async with pool.acquire() as connection:
        return await connection.fetchrow(query, *args)


async def fetch_all(query: str, *args: object) -> Sequence[asyncpg.Record]:
    pool = get_pool()
    async with pool.acquire() as connection:
        return await connection.fetch(query, *args)


async def execute(query: str, *args: object) -> str:
    pool = get_pool()
    async with pool.acquire() as connection:
        return await connection.execute(query, *args)
