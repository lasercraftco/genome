"""Smart features — Daily Mix, Discovery Weekly, Time Machine, Mood-of-the-moment."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import CurrentUser, current_user
from app.db import get_session
from app.models import Feedback, Station, StationTrack, Track
from app.schemas import StationListOut, StationOut

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/smart", tags=["smart"])


@router.post("/daily-mix")
async def generate_daily_mix(
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> StationListOut:
    """Generate up to 6 Daily Mix stations from the current user's recent thumb-ups."""
    upvoted = await _recent_upvoted_tracks(session, user_id=user.id, days=60, limit=300)
    if not upvoted:
        raise HTTPException(400, "not enough thumb-ups yet to seed Daily Mix")

    clusters = _cluster_by_tag(upvoted, k=6)
    out: list[Station] = []
    for i, cluster in enumerate(clusters[:6]):
        if not cluster:
            continue
        seed_track = cluster[0]
        st = Station(
            user_id=user.id,
            name=f"Daily Mix {i + 1}",
            seed_type="track",
            seed_id=seed_track.mbid or seed_track.id,
            seed_label=f"{seed_track.title} — {seed_track.artist}",
            exploration_ratio=0.25,
        )
        session.add(st)
        out.append(st)
    await session.flush()
    return StationListOut(stations=[_to_out(s) for s in out])


@router.post("/discovery-weekly")
async def generate_discovery_weekly(
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> StationOut:
    """Mondays — 30 unheard tracks based on Tyler's patterns. Implemented as a station
    with high exploration_ratio that excludes anything ever played."""
    seed = await _favorite_seed(session, user_id=user.id)
    if not seed:
        raise HTTPException(400, "not enough history yet for Discovery Weekly")
    week = datetime.now().strftime("%Y-W%V")
    st = Station(
        user_id=user.id,
        name=f"Discovery Weekly · {week}",
        seed_type="track",
        seed_id=seed.mbid or seed.id,
        seed_label=f"{seed.title} — {seed.artist}",
        exploration_ratio=0.6,
    )
    session.add(st)
    await session.flush()
    return _to_out(st)


@router.post("/time-machine")
async def time_machine(
    year: int = Query(...),
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> StationOut:
    """Build a station seeded by Tyler's most-played tracks from a given year (per scrobble history)."""
    from app.services import listenbrainz
    from app.config import get_settings

    s = get_settings()
    listens = await listenbrainz.listens_for_user(s.listenbrainz_user, limit=500)
    seed_track: tuple[str, str] | None = None
    for L in listens:
        ts = L.get("listened_at")
        if not ts:
            continue
        listened_year = datetime.fromtimestamp(int(ts), tz=timezone.utc).year
        if listened_year == year:
            tm = L.get("track_metadata") or {}
            seed_track = (tm.get("artist_name", ""), tm.get("track_name", ""))
            if seed_track[0] and seed_track[1]:
                break
    if not seed_track:
        raise HTTPException(404, f"no scrobbles found for {year}")
    st = Station(
        user_id=user.id,
        name=f"Time Machine · {year}",
        seed_type="track",
        seed_id=f"{seed_track[0]}|{seed_track[1]}",
        seed_label=f"{seed_track[1]} — {seed_track[0]}",
        exploration_ratio=0.30,
    )
    session.add(st)
    await session.flush()
    return _to_out(st)


@router.post("/mood-of-the-moment")
async def mood_of_the_moment(
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> StationOut:
    """Synthesizes a station from time-of-day + recent thumb-ups."""
    now = datetime.now()
    hour = now.hour
    bucket = "morning" if hour < 11 else "afternoon" if hour < 17 else "evening" if hour < 21 else "night"

    seed = await _favorite_seed(session, user_id=user.id)
    if not seed:
        raise HTTPException(400, "not enough history yet for mood-of-the-moment")

    expl_ratio = {"morning": 0.20, "afternoon": 0.25, "evening": 0.25, "night": 0.15}[bucket]
    st = Station(
        user_id=user.id,
        name=f"Mood · {bucket.title()}",
        seed_type="track",
        seed_id=seed.mbid or seed.id,
        seed_label=f"{seed.title} — {seed.artist}",
        exploration_ratio=expl_ratio,
    )
    session.add(st)
    await session.flush()
    return _to_out(st)


# ---------- helpers ----------

async def _recent_upvoted_tracks(session: AsyncSession, *, user_id: str, days: int, limit: int) -> list[Track]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    rows = await session.execute(
        select(Track)
        .join(Feedback, Feedback.track_id == Track.id)
        .where(Feedback.signal == "up", Feedback.user_id == user_id, Feedback.timestamp >= cutoff)
        .order_by(desc(Feedback.timestamp))
        .limit(limit)
    )
    return list(rows.scalars().all())


async def _favorite_seed(session: AsyncSession, *, user_id: str) -> Track | None:
    rows = await session.execute(
        select(Track, func.count(Feedback.id).label("ups"))
        .join(Feedback, Feedback.track_id == Track.id)
        .where(Feedback.signal == "up", Feedback.user_id == user_id)
        .group_by(Track.id)
        .order_by(desc("ups"))
        .limit(1)
    )
    row = rows.first()
    return row[0] if row else None


def _cluster_by_tag(tracks: list[Track], k: int) -> list[list[Track]]:
    """Naive tag-bucket clustering for Daily Mix."""
    from collections import defaultdict

    by_tag: dict[str, list[Track]] = defaultdict(list)
    for t in tracks:
        for tag in (t.tags or [])[:3]:
            by_tag[tag.lower()].append(t)
    # Pick the k largest buckets
    largest = sorted(by_tag.items(), key=lambda kv: -len(kv[1]))[:k]
    return [v for _, v in largest]


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
