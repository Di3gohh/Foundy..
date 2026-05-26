from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.config import settings
from app.core.filters import scan_item_text
from app.core.geo import mask_coordinates, validate_coordinates
from app.core.security import CurrentUser, get_current_user
from app.db.pool import fetch_all, fetch_one
from app.models.schemas import ItemCategory, ItemCreate, ItemPublic


router = APIRouter()


def serialize_item(row) -> ItemPublic:
    return ItemPublic(
        id=row["id"],
        item_type=row["item_type"],
        title=row["title"],
        description=row["description"],
        category=row["category"],
        status=row["status"],
        image_url=row["image_url"],
        location_label=row["location_label"],
        location_radius_meters=row["location_radius_meters"],
        latitude=float(row["latitude"]),
        longitude=float(row["longitude"]),
        distance_meters=float(row["distance_meters"]) if row["distance_meters"] is not None else None,
        is_premium=row["is_premium"],
        premium_until=row["premium_until"],
        created_at=row["created_at"],
    )


@router.get("", response_model=list[ItemPublic])
async def list_items(
    category: ItemCategory | None = None,
    near_latitude: float | None = None,
    near_longitude: float | None = None,
    radius_meters: Annotated[int, Query(ge=500, le=20_000)] = 5_000,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> list[ItemPublic]:
    where = ["status = 'published'"]
    args: list[object] = []

    if near_latitude is not None or near_longitude is not None:
        if near_latitude is None or near_longitude is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Informe latitude e longitude.")
        try:
            validate_coordinates(near_latitude, near_longitude)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

        args.extend([near_longitude, near_latitude, radius_meters])
        distance_sql = "st_distance(approx_location, st_setsrid(st_makepoint($1, $2), 4326)::geography)"
        where.append("st_dwithin(approx_location, st_setsrid(st_makepoint($1, $2), 4326)::geography, $3)")
    else:
        distance_sql = "null::double precision"

    if category is not None:
        args.append(category)
        where.append(f"category = ${len(args)}")

    args.append(limit)
    query = f"""
        select
          id,
          item_type,
          title,
          description,
          category,
          status,
          image_url,
          location_label,
          location_radius_meters,
          is_premium,
          premium_until,
          created_at,
          st_y(approx_location::geometry) as latitude,
          st_x(approx_location::geometry) as longitude,
          {distance_sql} as distance_meters
        from public.items
        where {" and ".join(where)}
        order by
          case when is_premium and premium_until > now() then 0 else 1 end,
          distance_meters asc nulls last,
          created_at desc
        limit ${len(args)}
    """

    rows = await fetch_all(query, *args)
    return [serialize_item(row) for row in rows]


@router.post("", response_model=ItemPublic, status_code=status.HTTP_201_CREATED)
async def create_item(
    payload: ItemCreate,
    current_user: CurrentUser = Depends(get_current_user),
) -> ItemPublic:
    title = payload.title.strip()
    description = payload.description.strip()
    if len(title) < 3 or len(description) < 10:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Preencha título e descrição válidos.")

    scan = scan_item_text(title, description)
    if scan.blocked:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=scan.reasons)

    try:
        masked_latitude, masked_longitude = mask_coordinates(
            payload.reported_latitude,
            payload.reported_longitude,
            settings.location_mask_radius_meters,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    row = await fetch_one(
        """
        insert into public.items (
          owner_id,
          item_type,
          title,
          description,
          category,
          image_url,
          location_label,
          approx_location,
          location_radius_meters,
          filter_status,
          filter_reasons
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          st_setsrid(st_makepoint($8, $9), 4326)::geography,
          $10,
          'clear',
          '[]'::jsonb
        )
        returning
          id,
          item_type,
          title,
          description,
          category,
          status,
          image_url,
          location_label,
          location_radius_meters,
          is_premium,
          premium_until,
          created_at,
          st_y(approx_location::geometry) as latitude,
          st_x(approx_location::geometry) as longitude,
          null::double precision as distance_meters
        """,
        current_user.id,
        payload.item_type,
        title,
        description,
        payload.category,
        str(payload.image_url) if payload.image_url else None,
        payload.location_label.strip() if payload.location_label else None,
        masked_longitude,
        masked_latitude,
        settings.location_mask_radius_meters,
    )

    return serialize_item(row)
