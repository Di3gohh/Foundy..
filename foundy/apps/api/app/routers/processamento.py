from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from app.services.ai_processing import blur_faces_and_sensitive_regions, to_base64_webp


router = APIRouter()


@router.post("/imagem")
async def processar_imagem(
    imagem: UploadFile = File(...),
    texto_extraido: str = Form(default=""),
) -> dict[str, object]:
    content = await imagem.read()
    if len(content) > 8 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Imagem muito grande.")

    try:
        processed, tags, motivos = blur_faces_and_sensitive_regions(content, texto_extraido)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Imagem invalida ou nao processavel.") from exc

    hashtags = [tag if tag.startswith("#") else f"#{tag}" for tag in tags]
    return {
        "mensagem": "Imagem processada com filtros de privacidade.",
        "imagem_webp_base64": to_base64_webp(processed),
        "tags_ia": tags,
        "hashtags_ia": hashtags,
        "texto_publico_padronizado": None,
        "motivos_privacidade": motivos,
    }
