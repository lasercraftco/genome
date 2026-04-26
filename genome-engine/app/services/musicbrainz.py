"""MusicBrainz wrapper — canonical artist/track MBIDs + cover art lookup."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx
import musicbrainzngs as mb
from cachetools import TTLCache

from app.config import get_settings

log = logging.getLogger(__name__)

_settings = get_settings()
mb.set_useragent("Genome", "0.1", "https://genome.tyflix.net")

_cache: TTLCache[str, Any] = TTLCache(maxsize=4096, ttl=60 * 60 * 24 * 7)  # 7 days
_caa_cache: TTLCache[str, str | None] = TTLCache(maxsize=4096, ttl=60 * 60 * 24 * 7)


async def _run(fn: Any, *args: Any, **kwargs: Any) -> Any:
    return await asyncio.to_thread(fn, *args, **kwargs)


async def search_artist(name: str, limit: int = 5) -> list[dict[str, Any]]:
    key = f"artist:{name.lower()}:{limit}"
    if key in _cache:
        return _cache[key]  # type: ignore[no-any-return]
    try:
        data = await _run(mb.search_artists, artist=name, limit=limit)
        out = data.get("artist-list", [])
        _cache[key] = out
        return list(out)
    except mb.MusicBrainzError as e:
        log.warning("mb search_artist failed: %s", e)
        return []


async def search_recording(artist: str, title: str, limit: int = 5) -> list[dict[str, Any]]:
    key = f"recording:{artist.lower()}:{title.lower()}:{limit}"
    if key in _cache:
        return _cache[key]  # type: ignore[no-any-return]
    try:
        query = f'recording:"{title}" AND artist:"{artist}"'
        data = await _run(mb.search_recordings, query=query, limit=limit)
        out = data.get("recording-list", [])
        _cache[key] = out
        return list(out)
    except mb.MusicBrainzError as e:
        log.warning("mb search_recording failed: %s", e)
        return []


async def lookup_recording(mbid: str) -> dict[str, Any] | None:
    if not mbid:
        return None
    key = f"recording-mbid:{mbid}"
    if key in _cache:
        return _cache[key]  # type: ignore[no-any-return]
    try:
        data = await _run(mb.get_recording_by_id, mbid, includes=["artists", "releases", "tags"])
        out = data.get("recording")
        _cache[key] = out
        return out
    except mb.MusicBrainzError:
        return None


async def coverart_url(release_mbid: str | None) -> str | None:
    """Cover Art Archive URL for a release. None if not available."""
    if not release_mbid:
        return None
    if release_mbid in _caa_cache:
        return _caa_cache[release_mbid]
    url = f"https://coverartarchive.org/release/{release_mbid}/front-500"
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.head(url, follow_redirects=True)
            if r.status_code == 200:
                _caa_cache[release_mbid] = url
                return url
    except httpx.HTTPError:
        pass
    _caa_cache[release_mbid] = None
    return None
