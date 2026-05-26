from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, HttpUrl


ItemCategory = Literal["documentos", "eletronicos", "chaves", "vestuario", "outros"]
ItemType = Literal["found", "lost"]


class PublicUser(BaseModel):
    id: UUID
    display_name: str


class AuthRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)
    display_name: str = Field(min_length=2, max_length=80)


class AuthLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: PublicUser


class ItemCreate(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    description: str = Field(min_length=10, max_length=2000)
    category: ItemCategory
    reported_latitude: float
    reported_longitude: float
    item_type: ItemType = "found"
    location_label: str | None = Field(default=None, max_length=160)
    image_url: HttpUrl | None = None


class ItemPublic(BaseModel):
    id: UUID
    item_type: ItemType
    title: str
    description: str
    category: ItemCategory
    status: str
    image_url: str | None
    location_label: str | None
    location_radius_meters: int
    latitude: float
    longitude: float
    distance_meters: float | None = None
    is_premium: bool
    premium_until: datetime | None
    created_at: datetime


class ChatRoomOut(BaseModel):
    id: UUID
    item_id: UUID
    owner_id: UUID
    claimant_id: UUID
    status: str
    extortion_flagged: bool
    human_review_status: str
    denunciar_extorsao_visivel: bool
    created_at: datetime


class ChatMessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


class ChatMessageOut(BaseModel):
    id: UUID
    room_id: UUID
    sender_id: UUID
    body: str
    scan_status: str
    scan_reasons: list[str]
    created_at: datetime


class ExtortionReportCreate(BaseModel):
    message_id: UUID | None = None
    reason: str = Field(min_length=5, max_length=500)
