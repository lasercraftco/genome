"""Playback — user-scoped."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import queue
from app.auth import CurrentUser, current_user
from app.db import get_session
from app.models import LibraryAdd, Station, StationTrack
from app.schemas import NowPlayingTrack, TrackOut, WhyExplanation
from app.sources import resolve_all

router = APIRouter(prefix="/api/play", tags=["play"])


def _own_or_404(s: Station | None, user: CurrentUser) -> Station:
    if not s or (s.user_id != user.id and user.role != "owner"):
        raise HTTPException(404, "station not found")
    return s


@router.get("/{station_id}/next", response_model=NowPlayingTrack)
async def next_track(
    station_id: str,
    deep_think: bool = Query(False),
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> NowPlayingTrack:
    station = _own_or_404(await session.get(Station, station_id), user)

    queued = await queue.next_n(session, station, n=1, deep_think=deep_think)
    if not queued:
        raise HTTPException(503, "no candidates resolvable right now")
    pick = queued[0]
    track = pick["track"]
    stream = pick["stream"]

    st = StationTrack(
        station_id=station.id,
        user_id=user.id,
        track_id=track["id"],
        explanation=pick["explanation"],
        score=float(pick["explanation"].get("similarity_score") or 0.0),
    )
    session.add(st)
    station.last_played_at = datetime.now(timezone.utc)

    in_lib_row = (
        await session.execute(
            select(LibraryAdd)
            .where(LibraryAdd.track_id == track["id"])
            .order_by(LibraryAdd.id.desc())
            .limit(1)
        )
    ).scalar_one_or_none()

    expl = pick["explanation"]
    return NowPlayingTrack(
        track=TrackOut(
            id=track["id"],
            mbid=track.get("mbid"),
            title=track["title"],
            artist=track["artist"],
            audio_features=track.get("audio_features", {}),
            tags=track.get("tags", []),
            artwork_url=track.get("artwork_url") or stream.get("artwork_url"),
            source=stream.get("source"),
            in_library=(in_lib_row is not None and in_lib_row.status == "in_library"),
            library_status=in_lib_row.status if in_lib_row else None,
            duration_ms=stream.get("duration_ms"),
        ),
        stream_url=stream["url"],
        stream_url_expires_at=stream["expires_at"],
        station_id=station.id,
        queue_position=0,
        explanation=WhyExplanation(
            reason=expl.get("reason", ""),
            sources=expl.get("sources", []),
            similarity_score=expl.get("similarity_score"),
            tag_overlap=expl.get("tag_overlap", []),
            feature_breakdown=expl.get("feature_breakdown", {}),
        ),
    )


@router.get("/{station_id}/queue", response_model=list[NowPlayingTrack])
async def get_queue(
    station_id: str,
    n: int = Query(3, ge=1, le=10),
    deep_think: bool = Query(False),
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> list[NowPlayingTrack]:
    station = _own_or_404(await session.get(Station, station_id), user)
    queued = await queue.next_n(session, station, n=n, deep_think=deep_think)
    out: list[NowPlayingTrack] = []
    for i, p in enumerate(queued):
        track = p["track"]
        stream = p["stream"]
        out.append(
            NowPlayingTrack(
                track=TrackOut(
                    id=track["id"],
                    mbid=track.get("mbid"),
                    title=track["title"],
                    artist=track["artist"],
                    audio_features=track.get("audio_features", {}),
                    tags=track.get("tags", []),
                    artwork_url=track.get("artwork_url") or stream.get("artwork_url"),
                    source=stream.get("source"),
                    duration_ms=stream.get("duration_ms"),
                ),
                stream_url=stream["url"],
                stream_url_expires_at=stream["expires_at"],
                station_id=station.id,
                queue_position=i,
                explanation=WhyExplanation(
                    reason=p["explanation"].get("reason", ""),
                    sources=p["explanation"].get("sources", []),
                    similarity_score=p["explanation"].get("similarity_score"),
                    tag_overlap=p["explanation"].get("tag_overlap", []),
                    feature_breakdown=p["explanation"].get("feature_breakdown", {}),
                ),
            )
        )
    return out


@router.get("/{station_id}/failover/{track_id}")
async def failover(
    station_id: str,
    track_id: str,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    from app.models import Track

    _own_or_404(await session.get(Station, station_id), user)
    track = await session.get(Track, track_id)
    if not track:
        raise HTTPException(404, "track not found")
    fallbacks: list[dict[str, Any]] = []
    async for r in resolve_all(track.artist, track.title):
        fallbacks.append(r.model_dump())
        if len(fallbacks) >= 3:
            break
    return {"alternatives": fallbacks}
