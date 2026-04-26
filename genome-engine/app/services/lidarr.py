"""Lidarr API client — adds wanted artists/tracks so the existing *arr stack
downloads them into Tyler's local library."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.config import get_settings

log = logging.getLogger(__name__)


def _client() -> tuple[httpx.AsyncClient, str]:
    s = get_settings()
    base = s.lidarr_url.rstrip("/")
    headers = {"X-Api-Key": s.lidarr_api_key, "Accept": "application/json"}
    return httpx.AsyncClient(base_url=base, headers=headers, timeout=20), base


async def find_artist(name: str) -> dict[str, Any] | None:
    async with (await _client_async())[0] as c:
        r = await c.get("/api/v1/artist/lookup", params={"term": name})
    if r.status_code != 200:
        return None
    results = r.json() or []
    return results[0] if results else None


async def add_artist(mb_id: str, name: str) -> dict[str, Any] | None:
    """Add an artist to Lidarr's wanted list with monitored=True."""
    async with (await _client_async())[0] as c:
        # Get the metadata profile + quality profile defaults (assume id=1 / id=1)
        r = await c.post(
            "/api/v1/artist",
            json={
                "foreignArtistId": mb_id,
                "monitored": True,
                "rootFolderPath": "/music",
                "qualityProfileId": 1,
                "metadataProfileId": 1,
                "addOptions": {
                    "monitor": "all",
                    "searchForMissingAlbums": True,
                },
                "artistName": name,
            },
        )
    if r.status_code in (200, 201):
        return r.json()
    log.warning("lidarr add_artist failed: %s %s", r.status_code, r.text[:200])
    return None


async def search_artist_albums(artist_id: int) -> bool:
    async with (await _client_async())[0] as c:
        r = await c.post(
            "/api/v1/command",
            json={"name": "ArtistSearch", "artistId": artist_id},
        )
    return r.status_code in (200, 201)


async def list_artists() -> list[dict[str, Any]]:
    async with (await _client_async())[0] as c:
        r = await c.get("/api/v1/artist")
    return list(r.json()) if r.status_code == 200 else []


async def _client_async() -> tuple[httpx.AsyncClient, str]:
    return _client()
