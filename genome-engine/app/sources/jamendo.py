"""Jamendo — free/CC music with a public API. No API key required for basic search."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

import httpx
from cachetools import TTLCache

from app.sources.base import ResolveResult

log = logging.getLogger(__name__)
_cache: TTLCache[str, ResolveResult] = TTLCache(maxsize=2048, ttl=60 * 60 * 24)


class JamendoResolver:
    name = "jamendo"
    quality = 60

    async def resolve(self, artist: str, title: str) -> ResolveResult | None:
        key = f"{artist.lower()}|{title.lower()}"
        if key in _cache:
            return _cache[key]
        try:
            async with httpx.AsyncClient(timeout=10) as c:
                r = await c.get(
                    "https://api.jamendo.com/v3.0/tracks/",
                    params={
                        "client_id": "975f81f4",  # public demo client_id; replace with own if rate-limited
                        "format": "json",
                        "limit": 1,
                        "search": f"{artist} {title}",
                    },
                )
            r.raise_for_status()
            results = r.json().get("results", [])
            if not results:
                return None
            t = results[0]
            stream_url = t.get("audio") or t.get("audiodownload")
            if not stream_url:
                return None
            result = ResolveResult(
                url=stream_url,
                expires_at=datetime.now(timezone.utc) + timedelta(days=7),
                source=self.name,
                source_id=str(t.get("id")),
                quality=self.quality,
                duration_ms=int((t.get("duration") or 0) * 1000),
                artwork_url=t.get("image"),
                title=t.get("name"),
            )
            _cache[key] = result
            return result
        except (httpx.HTTPError, ValueError) as e:
            log.debug("jamendo resolve failed: %s", e)
            return None


resolver = JamendoResolver()
