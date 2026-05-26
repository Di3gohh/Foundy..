import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.filters import scan_chat_message
from app.core.security import CurrentUser, get_current_user
from app.db.pool import execute, fetch_all, fetch_one
from app.models.schemas import ChatMessageCreate, ChatMessageOut, ChatRoomOut, ExtortionReportCreate


router = APIRouter()


def serialize_room(row) -> ChatRoomOut:
    return ChatRoomOut(
        id=row["id"],
        item_id=row["item_id"],
        owner_id=row["owner_id"],
        claimant_id=row["claimant_id"],
        status=row["status"],
        extortion_flagged=row["extortion_flagged"],
        human_review_status=row["human_review_status"],
        denunciar_extorsao_visivel=row["extortion_flagged"],
        created_at=row["created_at"],
    )


def serialize_message(row) -> ChatMessageOut:
    scan_reasons = row["scan_reasons"]
    if isinstance(scan_reasons, str):
        scan_reasons = json.loads(scan_reasons)

    return ChatMessageOut(
        id=row["id"],
        room_id=row["room_id"],
        sender_id=row["sender_id"],
        body=row["body"],
        scan_status=row["scan_status"],
        scan_reasons=list(scan_reasons),
        created_at=row["created_at"],
    )


async def ensure_room_member(room_id: UUID, user_id: UUID):
    row = await fetch_one(
        """
        select *
        from public.chat_rooms
        where id = $1 and (owner_id = $2 or claimant_id = $2)
        """,
        room_id,
        user_id,
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversa não encontrada.")
    return row


@router.post("/items/{item_id}/claim", response_model=ChatRoomOut, status_code=status.HTTP_201_CREATED)
async def claim_item(item_id: UUID, current_user: CurrentUser = Depends(get_current_user)) -> ChatRoomOut:
    item = await fetch_one(
        """
        select id, owner_id
        from public.items
        where id = $1 and status = 'published'
        """,
        item_id,
    )
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item não encontrado.")
    if item["owner_id"] == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Você já publicou este item.")

    row = await fetch_one(
        """
        insert into public.chat_rooms (item_id, owner_id, claimant_id)
        values ($1, $2, $3)
        on conflict (item_id, claimant_id)
        do update set updated_at = now()
        returning *
        """,
        item_id,
        item["owner_id"],
        current_user.id,
    )
    return serialize_room(row)


@router.get("/rooms/{room_id}/messages", response_model=list[ChatMessageOut])
async def list_messages(room_id: UUID, current_user: CurrentUser = Depends(get_current_user)) -> list[ChatMessageOut]:
    await ensure_room_member(room_id, current_user.id)
    rows = await fetch_all(
        """
        select id, room_id, sender_id, body, scan_status, scan_reasons, created_at
        from public.chat_messages
        where room_id = $1
        order by created_at asc
        """,
        room_id,
    )
    return [serialize_message(row) for row in rows]


@router.post("/rooms/{room_id}/messages", response_model=ChatMessageOut, status_code=status.HTTP_201_CREATED)
async def send_message(
    room_id: UUID,
    payload: ChatMessageCreate,
    current_user: CurrentUser = Depends(get_current_user),
) -> ChatMessageOut:
    await ensure_room_member(room_id, current_user.id)
    body = payload.body.strip()
    if not body:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Digite uma mensagem.")

    scan = scan_chat_message(body)
    scan_status = "flagged" if scan.flagged else "clear"

    row = await fetch_one(
        """
        insert into public.chat_messages (room_id, sender_id, body, scan_status, scan_reasons)
        values ($1, $2, $3, $4, $5::jsonb)
        returning id, room_id, sender_id, body, scan_status, scan_reasons, created_at
        """,
        room_id,
        current_user.id,
        body,
        scan_status,
        json.dumps(scan.reasons),
    )

    if scan.flagged:
        await execute(
            """
            update public.chat_rooms
            set extortion_flagged = true,
                human_review_status = 'pending',
                updated_at = now()
            where id = $1
            """,
            room_id,
        )

    return serialize_message(row)


@router.post("/rooms/{room_id}/reports", status_code=status.HTTP_201_CREATED)
async def report_extortion(
    room_id: UUID,
    payload: ExtortionReportCreate,
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, str]:
    await ensure_room_member(room_id, current_user.id)
    if payload.message_id is not None:
        message = await fetch_one(
            """
            select id
            from public.chat_messages
            where id = $1 and room_id = $2
            """,
            payload.message_id,
            room_id,
        )
        if message is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mensagem inválida para esta conversa.")

    await fetch_one(
        """
        insert into public.extortion_reports (room_id, reporter_id, message_id, reason)
        values ($1, $2, $3, $4)
        returning id
        """,
        room_id,
        current_user.id,
        payload.message_id,
        payload.reason.strip(),
    )
    await execute(
        """
        update public.chat_rooms
        set extortion_flagged = true,
            human_review_status = 'pending',
            updated_at = now()
        where id = $1
        """,
        room_id,
    )
    return {"mensagem": "Denúncia enviada para revisão."}
