import base64
import re
import unicodedata
from io import BytesIO

import cv2
import numpy as np
from PIL import Image, ImageFilter


CPF_RE = re.compile(r"\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b")
RG_RE = re.compile(r"\b(?:rg\s*[:\-]?\s*)?\d{1,2}\.?\d{3}\.?\d{3}-?[\dxX]\b", re.IGNORECASE)
NAME_RE = re.compile(
    r"(?:nome|name)\s*[:\-]\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ' ]{1,80})",
    re.IGNORECASE,
)

TAG_PATTERNS: dict[str, tuple[str, ...]] = {
    "#ChaveYale": ("chave yale", "yale", "chave"),
    "#ChaveiroDoMickey": ("mickey", "chaveiro mickey", "chaveiro do mickey"),
    "#FitaAzul": ("fita azul", "azul", "azulado"),
    "#CarteiraPreta": ("carteira preta", "wallet preta"),
    "#DocumentoPessoal": ("rg", "cpf", "documento", "identidade"),
    "#Celular": ("celular", "iphone", "samsung", "motorola"),
    "#PetEncontrado": ("pet", "cachorro", "gato", "coleira"),
}


def _normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    return ascii_text.casefold()


def _normalize_name(value: str) -> str:
    collapsed = " ".join(value.strip().split())
    return collapsed.title()


def standardize_document_public_text(extracted_text: str) -> str | None:
    if not extracted_text:
        return None

    has_document_hint = bool(CPF_RE.search(extracted_text) or RG_RE.search(extracted_text))
    if not has_document_hint:
        normalized_text = _normalize_text(extracted_text)
        has_document_hint = "rg" in normalized_text or "documento" in normalized_text

    if not has_document_hint:
        return None

    match = NAME_RE.search(extracted_text)
    owner_name = _normalize_name(match.group(1)) if match else "Nome não identificado"
    return f"RG encontrado em nome de {owner_name}"


def generate_hashtag_descriptors(*text_blocks: str) -> list[str]:
    normalized_text = _normalize_text(" ".join(text_blocks))
    hashtags: list[str] = []

    for hashtag, keywords in TAG_PATTERNS.items():
        if any(_normalize_text(keyword) in normalized_text for keyword in keywords):
            hashtags.append(hashtag)

    if not hashtags:
        hashtags.append("#ItemEncontrado")

    return hashtags[:8]


def blur_faces_and_sensitive_regions(image_bytes: bytes, extracted_text: str = "") -> tuple[bytes, list[str], list[str]]:
    image = Image.open(BytesIO(image_bytes)).convert("RGB")
    cv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
    gray = cv2.cvtColor(cv_image, cv2.COLOR_BGR2GRAY)

    reasons: list[str] = []
    generated_tags = generate_hashtag_descriptors(extracted_text)

    cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(40, 40))

    for x, y, w, h in faces:
        region = image.crop((x, y, x + w, y + h)).filter(ImageFilter.GaussianBlur(radius=18))
        image.paste(region, (x, y))

    if len(faces) > 0:
        reasons.append("Rosto detectado e desfocado automaticamente.")

    if CPF_RE.search(extracted_text) or RG_RE.search(extracted_text):
        width, height = image.size
        document_region = image.crop((0, int(height * 0.25), width, int(height * 0.72))).filter(
            ImageFilter.GaussianBlur(radius=24)
        )
        image.paste(document_region, (0, int(height * 0.25)))
        reasons.append("Possível documento detectado. Dados pessoais foram censurados.")
        if "#DocumentoPessoal" not in generated_tags:
            generated_tags.append("#DocumentoPessoal")

    output = BytesIO()
    image.save(output, format="WEBP", quality=82, method=6)
    return output.getvalue(), generated_tags, reasons


def to_base64_webp(image_bytes: bytes) -> str:
    return base64.b64encode(image_bytes).decode("ascii")
