"""Library integration — user-scoped, auto-approve for all roles.

All users (owner / trusted / friend): direct add. Row created with
status='auto_approved' and the background worker moves it through
adding → downloading → in_library (or failed).

Friends are rate-limited to ``users.daily_add_quota`` adds per 24h
(default 10). Owner/trusted are unlimited.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import CurrentUser, can_direct_add, current_user
from app.db import get_session, session_scope
from app.models import LibraryAdd, Track, User
from app.schemas import LibraryAddOut, LibraryAddRequest
from app.services import lidarr, musicbrainz, playlistdl
from app.sources import resolve_first

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/library", tags=["library"])


@router.post("/add", response_model=LibraryAddOut)
async def add_to_library(
    req: LibraryAddRequest,
    bg: BackgroundTasks,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> LibraryAddOut:
    track = await session.get(Track, req.track_id)
    if not track:
        raise HTTPException(404, "track not found")

    # Quota for friends only (owner/trusted have unlimited)
    db_user = await session.get(User, user.id)
    if user.role == "friend" and db_user is not None:
        cutoff = datetime.now(timezone.utc) - timedelta(days=1)
        recent = (
            await session.execute(
                select(func.count(LibraryAdd.id)).where(
                    and_(LibraryAdd.user_id == user.id, LibraryAdd.requested_at >= cutoff)
                )
            )
        ).scalar_one()
        # Use per-user quota or default 10/day for friends
        quota = db_user.daily_add_quota if db_user.daily_add_quota else 10
        if recent and recent >= quota:
            raise HTTPException(429, f"daily add quota reached ({quota})")

    # All users go through direct add path now
    add = LibraryAdd(
        user_id=user.id,
        track_id=req.track_id,
        status="auto_approved",
        approved_at=datetime.now(timezone.utc),
        approved_by=user.id,  # friend approves their own add
    )
    session.add(add)
    await session.flush()
    bg.add_task(_do_add, req.track_id, user.id, user.role)
    return LibraryAddOut(track_id=req.track_id, status=add.status)


@router.get("/status/{track_id}", response_model=LibraryAddOut)
async def get_status(
    track_id: str,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> LibraryAddOut:
    # Owner sees the global status; everyone else sees their own request status
    q = select(LibraryAdd).where(LibraryAdd.track_id == track_id)
    if user.role != "owner":
        q = q.where(LibraryAdd.user_id == user.id)
    row = (await session.execute(q.order_by(LibraryAdd.id.desc()).limit(1))).scalar_one_or_none()
    if not row:
        raise HTTPException(404, "no library_add for track")
    return LibraryAddOut(
        track_id=track_id,
        status=row.status,
        lidarr_request_id=row.lidarr_request_id,
        playlistdl_request_id=row.playlistdl_request_id,
        downloaded_path=row.downloaded_path,
        error=row.error,
    )


# ---------- admin ----------

@router.get("/requests")
async def list_requests(
    status: str = "requested",
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    if user.role != "owner":
        raise HTTPException(403, "owner only")
    rows = (
        await session.execute(
            select(LibraryAdd, Track, User)
            .join(Track, LibraryAdd.track_id == Track.id)
            .join(User, LibraryAdd.user_id == User.id)
            .where(LibraryAdd.status == status)
            .order_by(LibraryAdd.requested_at.desc())
            .limit(200)
        )
    ).all()
    return {
        "requests": [
            {
                "id": la.id,
                "status": la.status,
                "requested_at": la.requested_at.isoformat(),
                "track_id": tr.id,
                "track_artist": tr.artist,
                "track_title": tr.title,
                "artwork_url": tr.artwork_url,
                "user_email": u.email,
                "user_role": u.role,
            }
            for la, tr, u in rows
        ]
    }


@router.post("/requests/{add_id}/approve")
async def approve_request(
    add_id: int,
    bg: BackgroundTasks,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, str]:
    raise HTTPException(410, "approval gate removed; all adds are auto-approved")


@router.post("/requests/{add_id}/deny")
async def deny_request(
    add_id: int,
    payload: dict[str, str] | None = None,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, str]:
    raise HTTPException(410, "approval gate removed; all adds are auto-approved")


# ---------- background worker ----------

async def _do_add(track_id: str, user_id: str, role: str) -> None:
    async with session_scope() as session:
        track = await session.get(Track, track_id)
        if not track:
            return
        add = (
            await session.execute(
                select(LibraryAdd)
                .where(LibraryAdd.track_id == track_id, LibraryAdd.user_id == user_id)
                .order_by(LibraryAdd.id.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        if not add:
            return

        # 1) Lidarr
        mbid = track.mbid
        if not mbid:
            recs = await musicbrainz.search_recording(track.artist, track.title, limit=1)
            if recs:
                mbid = recs[0].get("id")
                track.mbid = mbid
        if mbid:
            try:
                artist_meta = await lidarr.find_artist(track.artist)
                if artist_meta:
                    res = await lidarr.add_artist(artist_meta.get("foreignArtistId", ""), track.artist)
                    if res:
                        add.lidarr_request_id = int(res.get("id", 0)) or None
                        add.status = "downloading"
                        return
            except Exception as e:  # noqa: BLE001
                log.warning("lidarr add failed: %s", e)

        # 2) playlist-dl
        resolved = await resolve_first(track.artist, track.title)
        if resolved and resolved.url:
            res = await playlistdl.submit_url(resolved.url)
            if res:
                add.playlistdl_request_id = str(res.get("job_id") or res.get("id") or "")
                add.status = "downloading"
                return

        add.status = "failed"
        add.error = "no source found and lidarr lookup failed"
