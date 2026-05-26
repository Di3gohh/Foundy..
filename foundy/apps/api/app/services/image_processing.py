from io import BytesIO

from fastapi import HTTPException, UploadFile, status
from PIL import Image


MAX_IMAGE_BYTES = 8 * 1024 * 1024
MAX_DIMENSION = 1600


async def compress_image_upload(upload: UploadFile) -> bytes:
    content = await upload.read()
    if len(content) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Imagem muito grande.")

    try:
        image = Image.open(BytesIO(content))
        image = image.convert("RGB")
        image.thumbnail((MAX_DIMENSION, MAX_DIMENSION))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Imagem inválida.") from exc

    output = BytesIO()
    image.save(output, format="WEBP", quality=82, method=6)
    return output.getvalue()
