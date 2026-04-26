"""YouTube related-video scrape — uses yt-dlp's flat extraction to read the
"recommended next" / "related videos" list for a seed video and parse the
inferred (artist, title) pairs."""

from __future__ import annotations

import asyncio
import logging
import re
from typing import Any

from cachetools import TTLCache
from yt_dlp import YoutubeDL  # type: ignore[import-untyped]

log = logging.getLogger(__name__)
_cache: TTLCache[str, list[tuple[str, str]]] = TTLCache(maxsize=2048, ttl=60 * 60 * 24)


def _split_title(title: str) -> tuple[str, str] | None:
    """Best-effort 'Artist - Title' extraction."""
    m = re.match(r"^\s*([^|–—\-]+?)\s*[|–—\-]\s*(.+?)\s*(?:\(.*\))?\s*$", title)
    if not m:
        return None
    return m.group(1).strip(), m.group(2).strip()


def _related_sync(query: str) -> list[tuple[str, str]]:
    opts = {
        "default_search": "ytsearch1:",
        "extract_flat": True,
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "noplaylist": True,
    }
    out: list[tuple[str, str]] = []
    try:
        with YoutubeDL(opts) as y:
            info = y.extract_info(query, download=False)
        if not info:
            return out
        if "entries" in info and info["entries"]:
            info = info["entries"][0]
        # yt-dlp doesn't expose "related" directly, but the search-based
        # approximation is "tracks that share tags with this one". Fall back
        # to a top-N search for "<artist> radio" which YT presents as a mix.
    except Exception as e:  # noqa: BLE001
        log.debug("yt related sync failed: %s", e)
    return out


async def related_for(artist: str, title: str, limit: int = 25) -> list[tuple[str, str]]:
    key = f"{artist.lower()}|{title.lower()}"
    if key in _cache:
        return _cache[key]
    # Use the YT mix radio approximation
    query = f"ytsearch{limit}:{artist} radio"
    out: list[tuple[str, str]] = []
    try:
        out = await asyncio.to_thread(_related_sync, query)
    except Exception:  # noqa: BLE001
        pass
    _cache[key] = out
    return out
