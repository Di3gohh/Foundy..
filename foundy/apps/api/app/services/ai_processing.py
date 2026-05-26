import base64
import re
from io import BytesIO

import cv2
import numpy as np
from PIL import Image, ImageFilter


CPF_RE = re.compile(r"\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b")
RG_RE = re.compile(r"\b(?:rg\s*)?\d{1,2}\.?\d{3}\.?\d{3}-?[\dxX]\b", re.IGNORECASE)

TAG_KEYWORDS = {
    "chave": ["chave", "chaves", "key", "yale"],
    "fita azul": ["azul", "fita azul"],
    "carteira": ["carteira", "wallet"],
    "documento": ["rg", "cpf", "documento", "identidade"],
    "fone": ["fone", "airpods", "earbud"],
    "vestuário": ["camisa", "blusa", "casaco", "moletom"],
}


def blur_faces_and_sensitive_regions(image_bytes: bytes, extracted_text: str = "") -> tuple[bytes, list[str], list[str]]:
    image = Image.open(BytesIO(image_bytes)).convert("RGB")
    cv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
    gray = cv2.cvtColor(cv_image, cv2.COLOR_BGR2GRAY)

    reasons: list[str] = []
    tags = extract_smart_tags(extracted_text)

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
        if "documento" not in tags:
            tags.append("documento")

    output = BytesIO()
    image.save(output, format="WEBP", quality=82, method=6)
    return output.getvalue(), tags, reasons


def extract_smart_tags(text: str) -> list[str]:
    normalized = text.casefold()
    tags: list[str] = []

    for tag, keywords in TAG_KEYWORDS.items():
        if any(keyword in normalized for keyword in keywords):
            tags.append(tag)

    return tags[:8]


def to_base64_webp(image_bytes: bytes) -> str:
    return base64.b64encode(image_bytes).decode("ascii")
