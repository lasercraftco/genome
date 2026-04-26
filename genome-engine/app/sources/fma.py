"""Free Music Archive — CC indie content. Site has been intermittently up;
we treat it as a soft fallback."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

import httpx
from cachetools import TTLCache

from app.sources.base import ResolveResult

log = logging.getLogger(__name__)
_cache: TTLCache[str, ResolveResult] = TTLCache(maxsize=2048, ttl=60 * 60 * 24)


class FreeMusicArchiveResolver:
    name = "free_music_archive"
    quality = 50

    async def resolve(self, artist: str, title: str) -> ResolveResult | None:
        key = f"{artist.lower()}|{title.lower()}"
        if key in _cache:
            return _cache[key]
        # Public dump mirror (FMA shut down its API; the dump is on archive.org)
        try:
            async with httpx.AsyncClient(timeout=10, follow_redirects=True) as c:
                r = await c.get(
                    "https://freemusicarchive.org/search",
                    params={"quicksearch": f"{artist} {title}"},
                )
            if r.status_code != 200:
                return None
            # Find the first /track/ link
            body = r.text
            idx = body.find('href="/track/')
            if idx == -1:
                return None
            start = idx + len('href="')
            end = body.find('"', start)
            track_path = body[start:end]
            track_url = f"https://freemusicarchive.org{track_path}"
            # FMA download URLs require a subsequent redirect; serve the page URL and
            # let yt-dlp fall back if the user actually plays it. Skip in this resolver.
            return None
        except httpx.HTTPError as e:
            log.debug("fma search failed: %s", e)
            return None


resolver = FreeMusicArchiveResolver()
