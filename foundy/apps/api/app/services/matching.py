from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True)
class MatchCandidate:
    lost_item_id: UUID
    found_item_id: UUID
    score: float
    reasons: list[str]


async def find_match_candidates(item_id: UUID) -> list[MatchCandidate]:
    # Futuro ponto de extensão para NLP/ML com busca textual + distância geográfica.
    return []
