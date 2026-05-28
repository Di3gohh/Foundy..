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
    "p i x",
    "p.i.x",
    "chave pix",
    "qr code",
    "qrcode",
    "pagamento",
    "pagar",
    "pague",
    "pagou",
    "cobranca",
    "cobro",
    "cobrar",
    "taxa",
    "taxinha",
    "resgate",
    "recompensa obrigatoria",
    "recompensa minima",
    "dinheiro",
    "deposito",
    "transferencia",
    "ted",
    "doc",
    "boleto",
    "cartao",
    "comprovante",
    "frete antecipado",
    "sinal",
    "valor",
    "grana",
}

COERCION_TERMS = {
    "so devolvo",
    "so entrego",
    "nao devolvo",
    "nao entrego",
    "para devolver",
    "para entregar",
    "se pagar",
    "se mandar",
    "manda o pix",
    "envia o pix",
    "faz o pix",
    "sem pagamento",
    "antes da entrega",
    "depois que pagar",
    "paga primeiro",
}

LEETSPEAK_TABLE = str.maketrans(
    {
        "0": "o",
        "1": "i",
        "3": "e",
        "4": "a",
        "5": "s",
        "7": "t",
        "@": "a",
        "$": "s",
        "!": "i",
    }
)

EMAIL_RE = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
CPF_RE = re.compile(r"\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b")
PHONE_RE = re.compile(r"(\+?55\s?)?(\(?\d{2}\)?\s?)?\d{4,5}[-.\s]?\d{4}")


def normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    translated = ascii_text.translate(LEETSPEAK_TABLE)
    return translated.casefold()


def _searchable_text(value: str) -> tuple[str, str]:
    normalized = normalize_text(value)
    separated = re.sub(r"[^a-z0-9]+", " ", normalized)
    separated = re.sub(r"\s+", " ", separated).strip()
    compact = re.sub(r"[^a-z0-9]+", "", normalized)
    return separated, compact


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
    normalized, compact = _searchable_text(body)
    payment_matches = [
        term
        for term in EXTORTION_TERMS
        if normalize_text(term) in normalized or normalize_text(term).replace(" ", "").replace(".", "") in compact
    ]
    coercion_matches = [
        term
        for term in COERCION_TERMS
        if normalize_text(term) in normalized or normalize_text(term).replace(" ", "").replace(".", "") in compact
    ]
    has_payment_term = bool(payment_matches)
    has_coercion = bool(coercion_matches)
    mentions_return = any(fragment in compact for fragment in ["devolv", "entreg", "retir", "resgat"])

    if has_payment_term and (has_coercion or "devolv" in normalized):
        reasons = ["Mensagem sinalizada por possivel extorsao financeira."]
        reasons.append(f"Termos financeiros detectados: {', '.join(payment_matches[:4])}.")
        if coercion_matches:
            reasons.append(f"Pressao ou condicao detectada: {', '.join(coercion_matches[:3])}.")
        return ScanResult(
            blocked=False,
            flagged=True,
            reasons=reasons,
        )

    if has_payment_term and mentions_return:
        return ScanResult(
            blocked=False,
            flagged=True,
            reasons=[
                "Mensagem sinalizada por associar pagamento ao processo de devolucao.",
                f"Termos financeiros detectados: {', '.join(payment_matches[:4])}.",
            ],
        )

    return ScanResult(blocked=False, flagged=False, reasons=[])
