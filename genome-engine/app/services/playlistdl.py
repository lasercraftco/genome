"""playlist-dl fallback — downloads from a YouTube/SoundCloud URL when
Lidarr can't find a track. Tyler's playlist-dl runs at dl.tyflix.net
(also known as spotify.tyflix.net)."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.config import get_settings

log = logging.getLogger(__name__)


async def submit_url(url: str) -> dict[str, Any] | None:
    """Submit a streaming URL for download to local /Volumes/Music."""
    s = get_settings()
    try:
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.post(
                f"{s.playlist_dl_url.rstrip('/')}/api/download",
                json={"url": url},
            )
        if r.status_code in (200, 201, 202):
            return r.json()  # type: ignore[no-any-return]
    except httpx.HTTPError as e:
        log.warning("playlist-dl submit failed: %s", e)
    return None


async def status(job_id: str) -> dict[str, Any] | None:
    s = get_settings()
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.get(f"{s.playlist_dl_url.rstrip('/')}/api/jobs/{job_id}")
        if r.status_code == 200:
            return r.json()  # type: ignore[no-any-return]
    except httpx.HTTPError:
        pass
    return None
