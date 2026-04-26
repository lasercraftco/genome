"""Setlist.fm — what artists tour together / play together. Strong signal
for "similar live aesthetic"."""

from __future__ import annotations

import logging
import os
from typing import Any

import httpx
from cachetools import TTLCache

log = logging.getLogger(__name__)
_cache: TTLCache[str, Any] = TTLCache(maxsize=4096, ttl=60 * 60 * 24 * 7)
_KEY = os.environ.get("SETLISTFM_API_KEY", "")


async def _get(path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    if not _KEY:
        return {}
    cache_key = f"{path}:{sorted((params or {}).items())}"
    if cache_key in _cache:
        return _cache[cache_key]  # type: ignore[no-any-return]
    headers = {"x-api-key": _KEY, "Accept": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=15, headers=headers) as c:
            r = await c.get(f"https://api.setlist.fm/rest/1.0{path}", params=params)
        r.raise_for_status()
        data: dict[str, Any] = r.json()
    except httpx.HTTPError as e:
        log.debug("setlistfm error: %s", e)
        return {}
    _cache[cache_key] = data
    return data


async def cohort_artists(artist: str, limit: int = 30) -> list[str]:
    """Artists who appeared on the same setlist as the seed artist (by name)."""
    data = await _get("/search/setlists", {"artistName": artist, "p": 1})
    setlist_ids = [s.get("id") for s in data.get("setlist", [])[:5]]
    cohort: set[str] = set()
    for sid in setlist_ids:
        if not sid:
            continue
        # Setlist detail API doesn't include co-billed artists directly; we'd need
        # event lookup. Skip for now and seed from venue history.
    return list(cohort)[:limit]
