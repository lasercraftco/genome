"""Station CRUD."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import CurrentUser, current_user
from app.db import get_session
from app.models import Station
from app.schemas import CreateStationRequest, StationListOut, StationOut, WeightsUpdate

router = APIRouter(prefix="/api/stations", tags=["stations"])


def _to_out(s: Station) -> StationOut:
    return StationOut(
        id=s.id,
        name=s.name,
        seed_type=s.seed_type,
        seed_id=s.seed_id,
        seed_label=s.seed_label,
        weights={k: float(v) for k, v in (s.weights or {}).items()},
        exploration_ratio=float(s.exploration_ratio),
        pinned=bool(s.pinned),
        auto_add=bool(s.auto_add),
        created_at=s.created_at,
        last_played_at=s.last_played_at,
    )


@router.post("", response_model=StationOut)
async def create_station(
    req: CreateStationRequest,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> StationOut:
    s = Station(
        user_id=user.id,
        name=req.name or req.seed_label,
        seed_type=req.seed_type,
        seed_id=req.seed_id,
        seed_label=req.seed_label,
    )
    session.add(s)
    await session.flush()
    return _to_out(s)


@router.get("", response_model=StationListOut)
async def list_stations(
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> StationListOut:
    rows = await session.execute(
        select(Station)
        .where(Station.user_id == user.id)
        .order_by(desc(Station.last_played_at), desc(Station.created_at))
    )
    return StationListOut(stations=[_to_out(s) for s in rows.scalars().all()])


def _own_or_404(s: Station | None, user: CurrentUser) -> Station:
    if not s or (s.user_id != user.id and user.role != "owner"):
        raise HTTPException(404, "station not found")
    return s


@router.get("/{station_id}", response_model=StationOut)
async def get_station(
    station_id: str,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> StationOut:
    s = _own_or_404(await session.get(Station, station_id), user)
    return _to_out(s)


@router.delete("/{station_id}")
async def delete_station(
    station_id: str,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, str]:
    s = _own_or_404(await session.get(Station, station_id), user)
    await session.delete(s)
    return {"status": "deleted"}


@router.patch("/{station_id}/weights", response_model=StationOut)
async def update_weights(
    station_id: str,
    req: WeightsUpdate,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> StationOut:
    s = _own_or_404(await session.get(Station, station_id), user)
    weights = dict(s.weights or {})
    if req.feature_weight is not None:
        weights["content"] = req.feature_weight
    if req.tag_weight is not None:
        weights["tag"] = req.tag_weight
    if req.lastfm_weight is not None or req.listenbrainz_weight is not None:
        weights["collaborative"] = (req.lastfm_weight or 0) + (req.listenbrainz_weight or 0)
    s.weights = weights
    if req.exploration_ratio is not None:
        s.exploration_ratio = max(0.0, min(0.9, req.exploration_ratio))
    if req.auto_add is not None:
        s.auto_add = req.auto_add
    return _to_out(s)


@router.post("/{station_id}/pin")
async def pin_station(
    station_id: str,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, bool]:
    s = _own_or_404(await session.get(Station, station_id), user)
    s.pinned = not s.pinned
    return {"pinned": s.pinned}
