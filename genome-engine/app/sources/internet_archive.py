"""Internet Archive — public domain, CC, Live Music Archive."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from cachetools import TTLCache

from app.sources.base import ResolveResult

log = logging.getLogger(__name__)
_cache: TTLCache[str, ResolveResult] = TTLCache(maxsize=2048, ttl=60 * 60 * 24)


class InternetArchiveResolver:
    name = "internet_archive"
    quality = 65

    async def resolve(self, artist: str, title: str) -> ResolveResult | None:
        key = f"{artist.lower()}|{title.lower()}"
        if key in _cache:
            return _cache[key]
        try:
            async with httpx.AsyncClient(timeout=10) as c:
                r = await c.get(
                    "https://archive.org/advancedsearch.php",
                    params={
                        "q": f'"{title}" AND creator:"{artist}" AND mediatype:audio',
                        "fl[]": ["identifier", "title", "creator", "mediatype"],
                        "rows": 1,
                        "page": 1,
                        "output": "json",
                    },
                )
            r.raise_for_status()
            docs: list[dict[str, Any]] = r.json().get("response", {}).get("docs", [])
            if not docs:
                return None
            ident = docs[0]["identifier"]
            # Get the file listing
            async with httpx.AsyncClient(timeout=10) as c:
                meta = await c.get(f"https://archive.org/metadata/{ident}")
            files = meta.json().get("files", [])
            audio = next(
                (f for f in files if f.get("name", "").lower().endswith((".mp3", ".ogg", ".m4a", ".flac"))),
                None,
            )
            if not audio:
                return None
            stream_url = f"https://archive.org/download/{ident}/{audio['name']}"
            result = ResolveResult(
                url=stream_url,
                expires_at=datetime.now(timezone.utc) + timedelta(days=7),
                source=self.name,
                source_id=ident,
                quality=self.quality,
                title=docs[0].get("title"),
            )
            _cache[key] = result
            return result
        except (httpx.HTTPError, ValueError, KeyError) as e:
            log.debug("internet_archive resolve failed: %s", e)
            return None


resolver = InternetArchiveResolver()
