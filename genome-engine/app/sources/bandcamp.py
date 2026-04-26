"""Bandcamp via yt-dlp — direct downloads from artists, indie heaven."""

from __future__ import annotations

import asyncio
import logging

import httpx
from cachetools import TTLCache

from app.sources._ytdlp_helpers import ytdlp_resolve
from app.sources.base import ResolveResult

log = logging.getLogger(__name__)
_search_cache: TTLCache[str, str | None] = TTLCache(maxsize=4096, ttl=60 * 60 * 24)


async def _bandcamp_search(artist: str, title: str) -> str | None:
    key = f"{artist.lower()}|{title.lower()}"
    if key in _search_cache:
        return _search_cache[key]
    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as c:
            r = await c.get(
                "https://bandcamp.com/search",
                params={"q": f"{artist} {title}", "item_type": "t"},
            )
        # Lightweight parse — first track URL in the page
        body = r.text
        marker = 'class="heading"><a href="'
        idx = body.find(marker)
        if idx == -1:
            _search_cache[key] = None
            return None
        start = idx + len(marker)
        end = body.find('"', start)
        url = body[start:end].split("?")[0]
        _search_cache[key] = url
        return url
    except (httpx.HTTPError, asyncio.TimeoutError) as e:
        log.debug("bandcamp search failed: %s", e)
        _search_cache[key] = None
        return None


class BandcampResolver:
    name = "bandcamp"
    quality = 90  # Bandcamp ships actual full FLACs/MP3s — high quality

    async def resolve(self, artist: str, title: str) -> ResolveResult | None:
        track_url = await _bandcamp_search(artist, title)
        if not track_url:
            return None
        return await ytdlp_resolve(artist, title, source=self.name, search_prefix=None, quality=self.quality)


resolver = BandcampResolver()
