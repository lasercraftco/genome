"""Audius — decentralized music platform, free, growing indie catalog."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from cachetools import TTLCache

from app.sources.base import ResolveResult

log = logging.getLogger(__name__)
_cache: TTLCache[str, ResolveResult] = TTLCache(maxsize=2048, ttl=60 * 60 * 6)


_DISCOVERY_NODES = [
    "https://discoveryprovider.audius.co",
    "https://discoveryprovider2.audius.co",
    "https://discoveryprovider3.audius.co",
]


async def _audius_get(path: str, params: dict[str, Any] | None = None) -> dict[str, Any] | None:
    for base in _DISCOVERY_NODES:
        try:
            async with httpx.AsyncClient(timeout=8) as c:
                r = await c.get(f"{base}/v1{path}", params=params, headers={"Accept": "application/json"})
            if r.status_code == 200:
                data: dict[str, Any] = r.json()
                return data
        except httpx.HTTPError:
            continue
    return None


class AudiusResolver:
    name = "audius"
    quality = 70

    async def resolve(self, artist: str, title: str) -> ResolveResult | None:
        key = f"{artist.lower()}|{title.lower()}"
        if key in _cache:
            return _cache[key]
        data = await _audius_get("/tracks/search", {"query": f"{artist} {title}"})
        if not data or not data.get("data"):
            return None
        track = data["data"][0]
        track_id = track["id"]
        # Audius track stream endpoint redirects to the audio
        stream_url = f"{_DISCOVERY_NODES[0]}/v1/tracks/{track_id}/stream"
        artwork = track.get("artwork", {}).get("480x480") or track.get("artwork", {}).get("150x150")
        result = ResolveResult(
            url=stream_url,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
            source=self.name,
            source_id=track_id,
            quality=self.quality,
            duration_ms=int((track.get("duration") or 0) * 1000),
            artwork_url=artwork,
            title=track.get("title"),
        )
        _cache[key] = result
        return result


resolver = AudiusResolver()
