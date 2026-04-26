"""Reddit r/ifyoulikeblank scraper — aggregate "if you like X try Y" patterns."""

from __future__ import annotations

import logging
import re
from typing import Any

import httpx
from cachetools import TTLCache

log = logging.getLogger(__name__)
_cache: TTLCache[str, list[str]] = TTLCache(maxsize=2048, ttl=60 * 60 * 24 * 7)

_HEADERS = {"User-Agent": "Genome/0.1 (homelab music discovery)"}


async def similar_artists_via_reddit(artist: str, limit: int = 25) -> list[str]:
    key = artist.lower()
    if key in _cache:
        return _cache[key]
    out: list[str] = []
    try:
        async with httpx.AsyncClient(timeout=15, headers=_HEADERS) as c:
            r = await c.get(
                "https://www.reddit.com/r/ifyoulikeblank/search.json",
                params={"q": artist, "restrict_sr": 1, "limit": 20, "sort": "relevance"},
            )
        if r.status_code != 200:
            return []
        children = r.json().get("data", {}).get("children", [])
        # Title pattern is often "[IIL] Artist X [WEWIL] anything like Artist Y"
        for c in children:
            title: str = c.get("data", {}).get("title", "")
            # Pull out any artists in [WEWIL] tail or after "anything like"
            tail = re.split(r"(?:\[WEWIL\]|anything like)", title, maxsplit=1, flags=re.I)
            if len(tail) > 1:
                candidates = [a.strip(" .,!?\"'") for a in re.split(r",|/| or |;", tail[1]) if a.strip()]
                for cand in candidates:
                    if cand and cand.lower() != artist.lower() and cand not in out:
                        out.append(cand)
            if len(out) >= limit:
                break
    except httpx.HTTPError as e:
        log.debug("reddit search failed: %s", e)
    _cache[key] = out[:limit]
    return out[:limit]
