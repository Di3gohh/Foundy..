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
    "piix",
    "p1x",
    "pics",
    "chave pix",
    "qr code",
    "qrcode",
    "pagamento",
    "pagamentos",
    "pagar",
    "pague",
    "pagou",
    "pago",
    "paga",
    "cobranca",
    "cobrança",
    "cobro",
    "cobrar",
    "cobrado",
    "taxa",
    "taxa de devolucao",
    "taxa de entrega",
    "taxinha",
    "taxinha de entrega",
    "ajuda de custo",
    "valor simbolico",
    "ajudinha",
    "resgate",
    "resgatar",
    "recompensa obrigatoria",
    "recompensa minima",
    "gratificacao obrigatoria",
    "dinheiro",
    "din",
    "deposito",
    "depósito",
    "transferencia",
    "transferência",
    "ted",
    "doc",
    "boleto",
    "cartao",
    "cartão",
    "comprovante",
    "frete antecipado",
    "frete",
    "sinal",
    "valor",
    "valores",
    "grana",
    "cash",
    "mb way",
    "paypal",
    "picpay",
    "mercado pago",
    "cripto",
    "bitcoin",
    "pixzinho",
    "manda dinheiro",
    "me paga",
}

COERCION_TERMS = {
    "so devolvo",
    "só devolvo",
    "so entrego",
    "só entrego",
    "nao devolvo",
    "não devolvo",
    "nao entrego",
    "não entrego",
    "para devolver",
    "para entregar",
    "para pegar de volta",
    "se quiser de volta",
    "se pagar",
    "se nao pagar",
    "se não pagar",
    "se mandar",
    "se enviar",
    "manda o pix",
    "envia o pix",
    "faz o pix",
    "passa o pix",
    "sem pagamento",
    "antes da entrega",
    "depois que pagar",
    "paga primeiro",
    "pague primeiro",
    "so depois",
    "só depois",
    "libero quando",
    "te devolvo quando",
    "te entrego quando",
    "nao vou devolver",
    "não vou devolver",
}

INSULT_TERMS = {
    "burro",
    "burra",
    "idiota",
    "imbecil",
    "otario",
    "otaria",
    "lixo",
    "palhaco",
    "palhaca",
    "vagabundo",
    "vagabunda",
    "golpista",
    "fdp",
    "filho da puta",
    "puta",
    "merda",
    "porra",
    "caralho",
    "desgracado",
    "desgracada",
    "arrombado",
    "arrombada",
    "caloteiro",
    "caloteira",
}

THREAT_TERMS = {
    "vou te bater",
    "vou te quebrar",
    "vou te pegar",
    "vou te achar",
    "vou te matar",
    "te mato",
    "te quebro",
    "ameaca",
    "se nao aparecer",
    "sei onde voce mora",
    "vou na sua casa",
    "vai se arrepender",
    "vou acabar com voce",
    "cuidado comigo",
    "vou expor voce",
    "vou publicar seus dados",
}

SCAM_TERMS = {
    "manda codigo",
    "me manda o codigo",
    "codigo sms",
    "codigo do sms",
    "senha",
    "token",
    "login",
    "cartao de credito",
    "dados bancarios",
    "numero do cartao",
    "codigo de verificacao",
    "confirma sua senha",
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
    searchable, compact = _searchable_text(original)
    reasons: list[str] = []

    if any(term in normalized for term in {normalize_text(term) for term in ILLICIT_TERMS}):
        reasons.append("O texto contém termos não permitidos para publicação.")
    if any(normalize_text(term) in searchable for term in THREAT_TERMS):
        reasons.append("O texto contem ameaca ou intimidacao.")
    if any(normalize_text(term) in searchable for term in INSULT_TERMS):
        reasons.append("O texto contem ofensa ou palavra de baixo calao.")
    if any(normalize_text(term).replace(" ", "") in compact for term in SCAM_TERMS):
        reasons.append("O texto solicita dados sensiveis ou credenciais.")
    if EMAIL_RE.search(original):
        reasons.append("Remova e-mails da descrição pública.")
    if CPF_RE.search(original):
        reasons.append("Remova CPF ou documentos completos da descrição pública.")
    if PHONE_RE.search(original):
        reasons.append("Remova telefones da descrição pública.")

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

    compact_without_spaces = re.sub(r"\s+", "", normalized)
    evasive_pix = bool(re.search(r"\bp\s*[\W_]*i\s*[\W_]*x\b", normalized)) or "pixin" in compact
    money_amount = bool(re.search(r"\b(?:r\$|rs)\s*\d+|\b\d+\s*(?:reais|conto|contos)\b", normalized))
    phone_or_key_like = bool(re.search(r"\b\d{2,}\s*[-.]?\s*\d{2,}\s*[-.]?\s*\d{2,}\b", normalized))

    if evasive_pix:
        payment_matches.append("pix escrito de forma disfarçada")
        has_payment_term = True

    if money_amount and mentions_return:
        payment_matches.append("valor em dinheiro associado à devolução")
        has_payment_term = True

    if phone_or_key_like and ("chave" in normalized or "pix" in compact_without_spaces):
        payment_matches.append("possível chave de pagamento")
        has_payment_term = True

    if has_payment_term and (has_coercion or "devolv" in normalized):
        reasons = ["Mensagem sinalizada por possível extorsão financeira."]
        reasons.append(f"Termos financeiros detectados: {', '.join(payment_matches[:4])}.")
        if coercion_matches:
            reasons.append(f"Pressão ou condição detectada: {', '.join(coercion_matches[:3])}.")
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
                "Mensagem sinalizada por associar pagamento ao processo de devolução.",
                f"Termos financeiros detectados: {', '.join(payment_matches[:4])}.",
            ],
        )

    threat_matches = [
        term
        for term in THREAT_TERMS
        if normalize_text(term) in normalized or normalize_text(term).replace(" ", "") in compact
    ]
    scam_matches = [
        term
        for term in SCAM_TERMS
        if normalize_text(term) in normalized or normalize_text(term).replace(" ", "") in compact
    ]
    insult_matches = [
        term
        for term in INSULT_TERMS
        if normalize_text(term) in normalized or normalize_text(term).replace(" ", "") in compact
    ]

    if threat_matches:
        return ScanResult(
            blocked=False,
            flagged=True,
            reasons=[
                "Mensagem sinalizada por ameaca, intimidacao ou risco fisico.",
                f"Termos de risco detectados: {', '.join(threat_matches[:3])}.",
            ],
        )

    if scam_matches:
        return ScanResult(
            blocked=False,
            flagged=True,
            reasons=[
                "Mensagem sinalizada por pedido de dados sensiveis ou possivel golpe.",
                f"Termos suspeitos detectados: {', '.join(scam_matches[:3])}.",
            ],
        )

    if insult_matches:
        return ScanResult(
            blocked=False,
            flagged=True,
            reasons=[
                "Mensagem sinalizada por ofensa, insulto ou palavra de baixo calao.",
                f"Termos ofensivos detectados: {', '.join(insult_matches[:3])}.",
            ],
        )
    return ScanResult(blocked=False, flagged=False, reasons=[])
