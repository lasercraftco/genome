"""Last.fm client — search, similar artists/tracks, top tags."""

from __future__ import annotations

import logging
from typing import Any

import httpx
from cachetools import TTLCache
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import get_settings

log = logging.getLogger(__name__)

_BASE = "https://ws.audioscrobbler.com/2.0/"
_cache: TTLCache[str, Any] = TTLCache(maxsize=2048, ttl=60 * 60 * 12)  # 12h


def _params(method: str, **kwargs: str | int) -> dict[str, str | int]:
    s = get_settings()
    return {"method": method, "api_key": s.lastfm_api_key, "format": "json", **kwargs}


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8), reraise=True)
async def _get(method: str, **kwargs: Any) -> dict[str, Any]:
    cache_key = f"{method}:{sorted(kwargs.items())}"
    if cache_key in _cache:
        return _cache[cache_key]  # type: ignore[no-any-return]
    s = get_settings()
    if not s.lastfm_api_key:
        log.warning("lastfm api key missing — returning empty result for %s", method)
        return {}
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(_BASE, params=_params(method, **kwargs))
        r.raise_for_status()
        data: dict[str, Any] = r.json()
    _cache[cache_key] = data
    return data


async def search_artist(query: str, limit: int = 8) -> list[dict[str, Any]]:
    data = await _get("artist.search", artist=query, limit=limit)
    return list(data.get("results", {}).get("artistmatches", {}).get("artist", []))


async def search_track(query: str, limit: int = 8) -> list[dict[str, Any]]:
    data = await _get("track.search", track=query, limit=limit)
    return list(data.get("results", {}).get("trackmatches", {}).get("track", []))


async def similar_artists(artist: str, limit: int = 50) -> list[dict[str, Any]]:
    data = await _get("artist.getSimilar", artist=artist, limit=limit, autocorrect=1)
    return list(data.get("similarartists", {}).get("artist", []))


async def similar_tracks(artist: str, track: str, limit: int = 100) -> list[dict[str, Any]]:
    data = await _get("track.getSimilar", artist=artist, track=track, limit=limit, autocorrect=1)
    return list(data.get("similartracks", {}).get("track", []))


async def top_tags_for_artist(artist: str) -> list[str]:
    data = await _get("artist.getTopTags", artist=artist, autocorrect=1)
    tags = data.get("toptags", {}).get("tag", [])
    return [t["name"] for t in tags[:8]]


async def top_tags_for_track(artist: str, track: str) -> list[str]:
    data = await _get("track.getTopTags", artist=artist, track=track, autocorrect=1)
    tags = data.get("toptags", {}).get("tag", [])
    return [t["name"] for t in tags[:8]]


async def top_tracks_by_tag(tag: str, limit: int = 100) -> list[dict[str, Any]]:
    data = await _get("tag.getTopTracks", tag=tag, limit=limit)
    return list(data.get("tracks", {}).get("track", []))
