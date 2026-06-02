from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import BackgroundTasks

from app.core.config import settings
from app.db.supabase_client import get_supabase
from app.services.email_service import send_support_email


def _action_for_occurrence(occurrence: int) -> tuple[str, str, dict]:
    if occurrence <= 1:
        return (
            "aviso",
            "Aviso de seguranca Foundy",
            {
                "ultimo_aviso_em": datetime.now(timezone.utc).isoformat(),
                "banimento_tipo": None,
            },
        )
    if occurrence == 2:
        until = datetime.now(timezone.utc) + timedelta(days=30)
        return (
            "suspensao_chat_30_dias",
            "Chat suspenso por 30 dias",
            {
                "chat_banido_ate": until.isoformat(),
                "chat_banido_permanente": False,
                "banimento_tipo": "chat",
            },
        )
    if occurrence == 3:
        until = datetime.now(timezone.utc) + timedelta(days=30)
        return (
            "suspensao_conta_30_dias",
            "Conta suspensa por 30 dias",
            {
                "banido_ate": until.isoformat(),
                "banido_permanente": False,
                "banimento_tipo": "conta",
            },
        )
    return (
        "banimento_permanente",
        "Conta banida permanentemente",
        {
            "banido_permanente": True,
            "banido_ate": None,
            "banimento_tipo": "conta",
        },
    )


async def aplicar_moderacao_progressiva(
    *,
    usuario_id: UUID | str,
    origem: str,
    motivos: list[str],
    conteudo_tipo: str,
    conteudo_id: UUID | str | None = None,
    trecho: str | None = None,
    background_tasks: BackgroundTasks | None = None,
) -> dict[str, str | int]:
    """Registra infracao e aplica a escala: aviso, chat, conta, banimento."""
    supabase = get_supabase()
    usuario_id_str = str(usuario_id)
    motivos_limpos = [motivo.strip() for motivo in motivos if motivo.strip()]
    motivo_principal = " ".join(motivos_limpos)[:700] or "Conduta fora das diretrizes Foundy."

    anteriores = await (
        supabase.table("moderacao_infracoes")
        .select("id", count="exact")
        .eq("usuario_id", usuario_id_str)
        .execute()
    )
    ocorrencia = (anteriores.count or len(anteriores.data or [])) + 1
    acao, titulo, updates = _action_for_occurrence(ocorrencia)

    await (
        supabase.table("moderacao_infracoes")
        .insert(
            {
                "usuario_id": usuario_id_str,
                "origem": origem,
                "conteudo_tipo": conteudo_tipo,
                "conteudo_id": str(conteudo_id) if conteudo_id else None,
                "motivos": motivos_limpos,
                "trecho": (trecho or "")[:500],
                "ocorrencia": ocorrencia,
                "acao_aplicada": acao,
            }
        )
        .execute()
    )

    updates["ultimo_aviso_moderacao"] = motivo_principal
    if acao.startswith("suspensao_chat"):
        updates["chat_banimento_motivo"] = motivo_principal
    if acao.startswith("suspensao_conta") or acao == "banimento_permanente":
        updates["banimento_motivo"] = motivo_principal

    await (
        supabase.table("usuarios")
        .update({**updates, "atualizado_em": datetime.now(timezone.utc).isoformat()})
        .eq("id", usuario_id_str)
        .execute()
    )

    if acao in {"suspensao_conta_30_dias", "banimento_permanente"}:
        usuario = await (
            supabase.table("usuarios")
            .select("ultimo_ip_hash")
            .eq("id", usuario_id_str)
            .limit(1)
            .execute()
        )
        ultimo_ip_hash = usuario.data[0].get("ultimo_ip_hash") if usuario.data else None
        if ultimo_ip_hash:
            await (
                supabase.table("ips_bloqueados")
                .upsert(
                    {
                        "ip_hash": ultimo_ip_hash,
                        "usuario_id": usuario_id_str,
                        "motivo": motivo_principal,
                        "banido_ate": updates.get("banido_ate"),
                        "permanente": acao == "banimento_permanente",
                        "admin_usuario_id": None,
                    },
                    on_conflict="ip_hash",
                )
                .execute()
            )

    await (
        supabase.table("notificacoes")
        .insert(
            {
                "usuario_id": usuario_id_str,
                "tipo": "sistema",
                "titulo": titulo,
                "mensagem": (
                    f"A moderacao automatica detectou conduta fora das diretrizes. "
                    f"Ocorrencia {ocorrencia}/4. Motivo: {motivo_principal}"
                ),
            }
        )
        .execute()
    )

    await (
        supabase.table("moderacao_eventos")
        .insert(
            {
                "tipo": "moderacao_automatica",
                "alvo_tipo": conteudo_tipo,
                "alvo_id": str(conteudo_id or usuario_id_str),
                "admin_usuario_id": None,
                "motivo": f"{titulo}: {motivo_principal}",
            }
        )
        .execute()
    )

    email_body = (
        "A moderacao automatica do Foundy aplicou uma medida.\n\n"
        f"Usuario: {usuario_id_str}\n"
        f"Origem: {origem}\n"
        f"Tipo de conteudo: {conteudo_tipo}\n"
        f"Conteudo ID: {conteudo_id or 'nao criado/informado'}\n"
        f"Ocorrencia: {ocorrencia}\n"
        f"Acao aplicada: {acao}\n"
        f"Motivos: {' | '.join(motivos_limpos)}\n"
        f"Trecho: {(trecho or '')[:500]}\n\n"
        f"Suporte configurado: {settings.support_email}"
    )
    await send_support_email(f"Moderacao automatica Foundy: {titulo}", email_body)

    return {"ocorrencia": ocorrencia, "acao": acao, "titulo": titulo, "motivo": motivo_principal}
