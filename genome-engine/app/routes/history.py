"""Per-station playback history with thumb history."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import CurrentUser, current_user
from app.db import get_session
from app.models import Station, StationTrack, Track

router = APIRouter(prefix="/api/stations", tags=["history"])


class HistoryEntry(BaseModel):
    track_id: str
    artist: str
    title: str
    artwork_url: str | None = None
    played_at: datetime
    feedback: str | None = None
    score: float | None = None
    explanation: dict[str, Any] = {}


class HistoryOut(BaseModel):
    station_id: str
    entries: list[HistoryEntry]


@router.get("/{station_id}/history", response_model=HistoryOut)
async def history(
    station_id: str,
    limit: int = Query(50, ge=1, le=500),
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> HistoryOut:
    station = await session.get(Station, station_id)
    if not station or (station.user_id != user.id and user.role != "owner"):
        raise HTTPException(404, "station not found")
    rows = await session.execute(
        select(StationTrack, Track)
        .join(Track, StationTrack.track_id == Track.id)
        .where(StationTrack.station_id == station_id, StationTrack.user_id == station.user_id)
        .order_by(desc(StationTrack.played_at))
        .limit(limit)
    )
    entries: list[HistoryEntry] = []
    for st, tr in rows.all():
        entries.append(
            HistoryEntry(
                track_id=tr.id,
                artist=tr.artist,
                title=tr.title,
                artwork_url=tr.artwork_url,
                played_at=st.played_at,
                feedback=st.feedback,
                score=st.score,
                explanation=st.explanation or {},
            )
        )
    return HistoryOut(station_id=station_id, entries=entries)
