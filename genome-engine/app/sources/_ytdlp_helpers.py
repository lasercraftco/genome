"""Shared yt-dlp invocation helpers used by every yt-dlp-backed resolver."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from cachetools import TTLCache
from yt_dlp import YoutubeDL  # type: ignore[import-untyped]

from app.config import get_settings
from app.sources.base import ResolveResult

log = logging.getLogger(__name__)
_settings = get_settings()
_sem = asyncio.Semaphore(_settings.ytdlp_concurrent_resolves)
_HIT_CACHE: TTLCache[str, ResolveResult] = TTLCache(maxsize=8192, ttl=_settings.ytdlp_cache_ttl_seconds)
_MISS_CACHE: TTLCache[str, bool] = TTLCache(maxsize=8192, ttl=60 * 30)  # 30min miss TTL


_BASE_OPTS: dict[str, Any] = {
    "format": "bestaudio[acodec=opus]/bestaudio/best",
    "quiet": True,
    "no_warnings": True,
    "noplaylist": True,
    "skip_download": True,
    "socket_timeout": 20,
}


def _ytdl(extra: dict[str, Any] | None = None) -> YoutubeDL:
    o = dict(_BASE_OPTS)
    if extra:
        o.update(extra)
    return YoutubeDL(o)


def _sync_resolve(query: str, search_prefix: str | None) -> dict[str, Any] | None:
    opts: dict[str, Any] = {}
    if search_prefix:
        opts["default_search"] = f"{search_prefix}1:"
    with _ytdl(opts) as y:
        try:
            info = y.extract_info(query, download=False)
        except Exception as e:  # noqa: BLE001
            log.debug("yt-dlp extract_info failed: %s", e)
            return None
    if not info:
        return None
    if "entries" in info and info["entries"]:
        info = info["entries"][0]
    return dict(info) if info else None


async def ytdlp_resolve(
    artist: str,
    title: str,
    *,
    source: str,
    search_prefix: str | None,
    quality: int,
) -> ResolveResult | None:
    """Run yt-dlp with the given search prefix and turn it into a ResolveResult."""
    cache_key = f"{source}|{artist.lower()}|{title.lower()}"
    if cache_key in _MISS_CACHE:
        return None
    cached = _HIT_CACHE.get(cache_key)
    if cached and cached.expires_at > datetime.now(timezone.utc):
        return cached

    query = f"{artist} - {title}"
    async with _sem:
        info = await asyncio.to_thread(_sync_resolve, query, search_prefix)
    if not info:
        _MISS_CACHE[cache_key] = True
        return None

    url: str | None = info.get("url")
    if not url:
        formats = info.get("formats", [])
        audio_formats = [f for f in formats if f.get("acodec") and f.get("acodec") != "none"]
        if audio_formats:
            url = audio_formats[-1]["url"]
    if not url:
        _MISS_CACHE[cache_key] = True
        return None

    duration_s = info.get("duration") or 0
    thumbs = info.get("thumbnails") or []
    artwork = thumbs[-1]["url"] if thumbs else None
    expires = datetime.now(timezone.utc) + timedelta(seconds=_settings.ytdlp_cache_ttl_seconds)
    result = ResolveResult(
        url=url,
        expires_at=expires,
        source=source,
        source_id=info.get("id"),
        quality=quality,
        duration_ms=int(duration_s * 1000),
        artwork_url=artwork,
        title=info.get("title"),
    )
    _HIT_CACHE[cache_key] = result
    return result
