"""Search — Last.fm + MusicBrainz + library, merged."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import Track
from app.schemas import SearchResponse, SearchResult
from app.services import lastfm, musicbrainz

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("", response_model=SearchResponse)
async def search(q: str = Query(..., min_length=1), session: AsyncSession = Depends(get_session)) -> SearchResponse:
    results: list[SearchResult] = []

    # Local library matches first
    rows = await session.execute(
        select(Track).where(or_(Track.artist.ilike(f"%{q}%"), Track.title.ilike(f"%{q}%"))).limit(8)
    )
    for tr in rows.scalars().all():
        results.append(
            SearchResult(
                kind="track",
                id=tr.id,
                label=tr.title,
                sublabel=tr.artist,
                artwork_url=tr.artwork_url,
                mbid=tr.mbid,
            )
        )

    # Last.fm artist + track
    for a in await lastfm.search_artist(q, limit=4):
        results.append(
            SearchResult(
                kind="artist",
                id=a.get("mbid") or f"lastfm-artist:{a.get('name')}",
                label=a.get("name", ""),
                sublabel=f"{a.get('listeners', '0')} listeners",
                artwork_url=_image(a.get("image")),
                mbid=a.get("mbid"),
            )
        )
    for t in await lastfm.search_track(q, limit=6):
        results.append(
            SearchResult(
                kind="track",
                id=t.get("mbid") or f"lastfm-track:{t.get('artist')}:{t.get('name')}",
                label=t.get("name", ""),
                sublabel=t.get("artist"),
                artwork_url=_image(t.get("image")),
                mbid=t.get("mbid"),
            )
        )

    # MusicBrainz canonical
    for a in await musicbrainz.search_artist(q, limit=3):
        results.append(
            SearchResult(
                kind="artist",
                id=a.get("id", ""),
                label=a.get("name", ""),
                sublabel=", ".join(a.get("tag-list", [])[:3]) or None,
                mbid=a.get("id"),
            )
        )

    return SearchResponse(query=q, results=results[:30])


def _image(images: Any) -> str | None:
    if isinstance(images, list):
        for img in reversed(images):
            url = img.get("#text") if isinstance(img, dict) else None
            if url:
                return url
    return None
