import re
import unicodedata
from dataclasses import dataclass


@dataclass(frozen=True)
class ScanResult:
    blocked: bool
    flagged: bool
    reasons: list[str]


ILLICIT_TERMS = {
    "arma",
    "municao",
    "droga",
    "drogas",
    "cocaina",
    "maconha",
    "documento falso",
    "medicamento controlado",
    "substancia ilicita",
}

EXTORTION_TERMS = {
    "pix",
    "pagamento",
    "pagar",
    "cobranca",
    "resgate",
    "taxa",
    "dinheiro",
    "transferencia",
    "recompensa obrigatoria",
}

COERCION_TERMS = {
    "so devolvo",
    "nao devolvo",
    "para devolver",
    "se pagar",
    "manda o pix",
    "envia o pix",
}

EMAIL_RE = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
CPF_RE = re.compile(r"\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b")
PHONE_RE = re.compile(r"(\+?55\s?)?(\(?\d{2}\)?\s?)?\d{4,5}[-.\s]?\d{4}")


def normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    return ascii_text.casefold()


def censor_sensitive_text(value: str) -> str:
    value = EMAIL_RE.sub("[e-mail ocultado]", value)
    value = CPF_RE.sub("[documento ocultado]", value)
    value = PHONE_RE.sub("[telefone ocultado]", value)
    return value


def scan_item_text(title: str, description: str) -> ScanResult:
    original = f"{title}\n{description}"
    normalized = normalize_text(original)
    reasons: list[str] = []

    if any(term in normalized for term in {normalize_text(term) for term in ILLICIT_TERMS}):
        reasons.append("O texto contem termos nao permitidos para publicacao.")
    if EMAIL_RE.search(original):
        reasons.append("Remova e-mails da descricao publica.")
    if CPF_RE.search(original):
        reasons.append("Remova CPF ou documentos completos da descricao publica.")
    if PHONE_RE.search(original):
        reasons.append("Remova telefones da descricao publica.")

    return ScanResult(blocked=bool(reasons), flagged=bool(reasons), reasons=reasons)


def scan_chat_message(body: str) -> ScanResult:
    normalized = normalize_text(body)
    has_payment_term = any(normalize_text(term) in normalized for term in EXTORTION_TERMS)
    has_coercion = any(normalize_text(term) in normalized for term in COERCION_TERMS)

    if has_payment_term and (has_coercion or "devolv" in normalized):
        return ScanResult(
            blocked=False,
            flagged=True,
            reasons=["Mensagem sinalizada por possivel extorsao financeira."],
        )

    return ScanResult(blocked=False, flagged=False, reasons=[])
