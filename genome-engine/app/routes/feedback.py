"""Feedback ingestion — user-scoped."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import CurrentUser, current_user
from app.db import get_session
from app.models import Feedback, Station, StationTrack, Track
from app.schemas import FeedbackRequest

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/feedback", tags=["feedback"])


@router.post("")
async def post_feedback(
    req: FeedbackRequest,
    bg: BackgroundTasks,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    track = await session.get(Track, req.track_id)
    if not track:
        raise HTTPException(404, "track not found")
    fb = Feedback(user_id=user.id, track_id=req.track_id, station_id=req.station_id, signal=req.signal)
    session.add(fb)

    if req.station_id:
        st = (
            await session.execute(
                select(StationTrack)
                .where(
                    StationTrack.station_id == req.station_id,
                    StationTrack.user_id == user.id,
                    StationTrack.track_id == req.track_id,
                )
                .order_by(StationTrack.played_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        if st and st.feedback is None:
            st.feedback = req.signal

        station = await session.get(Station, req.station_id)
        if station and station.user_id == user.id:
            _nudge_weights(station, track, req.signal)
            if req.signal == "up" and station.auto_add:
                from app.routes.library import _do_add  # local import to avoid cycle

                bg.add_task(_do_add, req.track_id, user.id, user.role)

    return {"status": "ok"}


def _nudge_weights(station: Station, track: Track, signal: str) -> None:
    weights = dict(station.weights or {})
    delta = 0.02 if signal == "up" else (-0.02 if signal == "down" else (-0.005 if signal == "skip" else 0.0))
    if delta == 0:
        return
    features = track.audio_features or {}
    if features.get("energy") is not None or features.get("bpm") is not None:
        weights["content"] = max(0.05, min(0.7, (weights.get("content", 0.30) + delta)))
    elif track.tags:
        weights["tag"] = max(0.05, min(0.7, (weights.get("tag", 0.20) + delta)))
    else:
        weights["collaborative"] = max(0.05, min(0.7, (weights.get("collaborative", 0.25) + delta)))
    station.weights = weights
