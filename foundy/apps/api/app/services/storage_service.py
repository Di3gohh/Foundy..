import asyncio
import base64
import hashlib
import mimetypes
import re
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone

from app.core.config import settings


DATA_URL_RE = re.compile(r"^data:(?P<mime>image/[a-zA-Z0-9.+-]+);base64,(?P<data>.+)$", re.DOTALL)


@dataclass
class ParsedImage:
    content: bytes
    mime_type: str
    extension: str


def _parse_data_url(value: str) -> ParsedImage | None:
    match = DATA_URL_RE.match(value.strip())
    if not match:
        return None
    mime_type = match.group("mime").lower()
    if mime_type not in {"image/webp", "image/jpeg", "image/png"}:
        return None
    content = base64.b64decode(match.group("data"), validate=True)
    if len(content) > settings.storage_max_image_bytes:
        raise ValueError("A imagem está muito grande. Envie uma foto com até 5 MB.")
    extension = mimetypes.guess_extension(mime_type) or ".webp"
    if extension == ".jpe":
        extension = ".jpg"
    return ParsedImage(content=content, mime_type=mime_type, extension=extension)


def _public_storage_url(path: str) -> str:
    base_url = settings.supabase_url.rstrip("/")
    bucket = settings.supabase_storage_bucket
    return f"{base_url}/storage/v1/object/public/{bucket}/{path}"


async def store_public_image_if_needed(value: str | None, folder: str) -> str | None:
    """Upload data URLs to Supabase Storage and return a compact public URL.

    If Storage is not configured or the value is already a normal URL, the original
    value is returned so the app keeps working in test mode.
    """
    if not value:
        return None
    if not value.startswith("data:image/"):
        return value
    parsed = _parse_data_url(value)
    if parsed is None:
        return None
    if not settings.supabase_url or not settings.supabase_backend_key or not settings.supabase_storage_bucket:
        return value

    digest = hashlib.sha256(parsed.content).hexdigest()[:18]
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    path = f"{folder.strip('/')}/{timestamp}-{digest}{parsed.extension}"
    upload_url = f"{settings.supabase_url.rstrip('/')}/storage/v1/object/{settings.supabase_storage_bucket}/{path}"
    request = urllib.request.Request(
        upload_url,
        data=parsed.content,
        method="POST",
        headers={
            "Authorization": f"Bearer {settings.supabase_backend_key}",
            "apikey": settings.supabase_backend_key,
            "Content-Type": parsed.mime_type,
            "x-upsert": "true",
        },
    )
    try:
        await asyncio.to_thread(lambda: urllib.request.urlopen(request, timeout=15).read())
    except urllib.error.HTTPError as exc:
        raise ValueError("Não foi possível salvar a imagem no Storage do Supabase.") from exc
    except urllib.error.URLError as exc:
        raise ValueError("O Storage do Supabase não respondeu. Tente novamente em instantes.") from exc
    return _public_storage_url(path)
