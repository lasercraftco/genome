"""Discogs — deep genre/style metadata, label graph, artist relationships.
Uses the public consumer-key + secret if available; falls back to anonymous
search (rate limited but functional)."""

from __future__ import annotations

import logging
import os
from typing import Any

import httpx
from cachetools import TTLCache
from tenacity import retry, stop_after_attempt, wait_exponential

log = logging.getLogger(__name__)
_cache: TTLCache[str, Any] = TTLCache(maxsize=4096, ttl=60 * 60 * 24 * 7)

_TOKEN = os.environ.get("DISCOGS_TOKEN", "")
_USER_AGENT = "Genome/0.1 +https://genome.tyflix.net"


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8), reraise=True)
async def _get(path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    key = f"{path}:{sorted((params or {}).items())}"
    if key in _cache:
        return _cache[key]  # type: ignore[no-any-return]
    headers = {"User-Agent": _USER_AGENT}
    if _TOKEN:
        headers["Authorization"] = f"Discogs token={_TOKEN}"
    async with httpx.AsyncClient(timeout=15, headers=headers) as c:
        r = await c.get(f"https://api.discogs.com{path}", params=params)
        if r.status_code == 429:
            log.warning("discogs rate-limited")
            return {}
        r.raise_for_status()
        data: dict[str, Any] = r.json()
    _cache[key] = data
    return data


async def search_release(artist: str, title: str) -> dict[str, Any] | None:
    try:
        data = await _get(
            "/database/search",
            {"q": f"{artist} {title}", "type": "release", "per_page": 1},
        )
        results = data.get("results", [])
        return results[0] if results else None
    except httpx.HTTPError as e:
        log.debug("discogs search_release failed: %s", e)
        return None


async def styles_for(artist: str, title: str) -> list[str]:
    rel = await search_release(artist, title)
    if not rel:
        return []
    return list(rel.get("style", [])) + list(rel.get("genre", []))


async def label_for(artist: str, title: str) -> str | None:
    rel = await search_release(artist, title)
    if not rel:
        return None
    labels = rel.get("label", [])
    return labels[0] if labels else None
