"""ccMixter — Creative Commons remixes."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

import httpx
from cachetools import TTLCache

from app.sources.base import ResolveResult

log = logging.getLogger(__name__)
_cache: TTLCache[str, ResolveResult] = TTLCache(maxsize=2048, ttl=60 * 60 * 24)


class CcMixterResolver:
    name = "ccmixter"
    quality = 40

    async def resolve(self, artist: str, title: str) -> ResolveResult | None:
        key = f"{artist.lower()}|{title.lower()}"
        if key in _cache:
            return _cache[key]
        try:
            async with httpx.AsyncClient(timeout=10) as c:
                r = await c.get(
                    "http://ccmixter.org/api/query",
                    params={
                        "f": "json",
                        "search": f"{artist} {title}",
                        "limit": 1,
                    },
                )
            r.raise_for_status()
            results = r.json()
            if not results:
                return None
            t = results[0]
            stream_url = t.get("files", [{}])[0].get("download_url")
            if not stream_url:
                return None
            result = ResolveResult(
                url=stream_url,
                expires_at=datetime.now(timezone.utc) + timedelta(days=30),
                source=self.name,
                source_id=str(t.get("upload_id")),
                quality=self.quality,
                title=t.get("upload_name"),
            )
            _cache[key] = result
            return result
        except (httpx.HTTPError, ValueError, IndexError, KeyError) as e:
            log.debug("ccmixter resolve failed: %s", e)
            return None


resolver = CcMixterResolver()
