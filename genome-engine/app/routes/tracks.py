"""Track lookup — for the 'Why this song?' details panel."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import Track
from app.schemas import TrackOut

router = APIRouter(prefix="/api/tracks", tags=["tracks"])


@router.get("/{track_id}", response_model=TrackOut)
async def get_track(track_id: str, session: AsyncSession = Depends(get_session)) -> TrackOut:
    t = await session.get(Track, track_id)
    if not t:
        raise HTTPException(404, "track not found")
    return TrackOut(
        id=t.id,
        mbid=t.mbid,
        title=t.title,
        artist=t.artist,
        album=t.album,
        duration_ms=t.duration_ms,
        artwork_url=t.artwork_url,
        audio_features=t.audio_features or {},
        tags=t.tags or [],
        source=t.source,
    )
