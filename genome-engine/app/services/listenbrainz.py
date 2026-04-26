"""ListenBrainz recommendation client."""

from __future__ import annotations

import logging
from typing import Any

import httpx
from cachetools import TTLCache
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import get_settings

log = logging.getLogger(__name__)

_BASE = "https://api.listenbrainz.org/1"
_LB_BASE = "https://labs.api.listenbrainz.org/recording-similarity"
_cache: TTLCache[str, Any] = TTLCache(maxsize=2048, ttl=60 * 60 * 12)


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8), reraise=True)
async def _get(url: str, params: dict[str, Any] | None = None, auth: bool = False) -> dict[str, Any]:
    cache_key = f"{url}:{sorted((params or {}).items())}"
    if cache_key in _cache:
        return _cache[cache_key]  # type: ignore[no-any-return]
    headers: dict[str, str] = {}
    if auth:
        s = get_settings()
        if s.listenbrainz_token:
            headers["Authorization"] = f"Token {s.listenbrainz_token}"
    async with httpx.AsyncClient(timeout=15.0, headers=headers) as client:
        r = await client.get(url, params=params)
        if r.status_code == 404:
            return {}
        r.raise_for_status()
        data: dict[str, Any] = r.json()
    _cache[cache_key] = data
    return data


async def similar_recordings(mbid: str, limit: int = 50) -> list[dict[str, Any]]:
    """Get similar recordings by MBID using the labs recording-similarity endpoint."""
    if not mbid:
        return []
    try:
        url = f"{_LB_BASE}/json"
        data = await _get(url, params={"recording_mbids": mbid, "algorithm": "session_based_days_7500_session_300_contribution_5_threshold_10_limit_50_filter_True_skip_30"})
        items = data.get("recording_mbid", []) if isinstance(data, dict) else []
        if isinstance(items, list):
            return items[:limit]
    except httpx.HTTPError as e:
        log.warning("listenbrainz similar_recordings failed: %s", e)
    return []


async def listens_for_user(user: str, limit: int = 100) -> list[dict[str, Any]]:
    data = await _get(f"{_BASE}/user/{user}/listens", params={"count": limit})
    return list(data.get("payload", {}).get("listens", []))


async def fresh_releases_for_user(user: str) -> list[dict[str, Any]]:
    data = await _get(f"{_BASE}/user/{user}/fresh_releases", auth=True)
    return list(data.get("payload", {}).get("releases", []))
