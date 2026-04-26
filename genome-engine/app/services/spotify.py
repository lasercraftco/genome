"""Spotify API — metadata only. No streaming, no playback. Used purely for
audio-features (BPM, key, energy, danceability, valence, etc.) and as a search
augment. Per Tyler's strategy memory, do NOT integrate Spotify Connect."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx
import spotipy
from cachetools import TTLCache
from spotipy.oauth2 import SpotifyClientCredentials

from app.config import get_settings

log = logging.getLogger(__name__)
_cache: TTLCache[str, Any] = TTLCache(maxsize=4096, ttl=60 * 60 * 24 * 30)  # 30 days

_client: spotipy.Spotify | None = None


def _get_client() -> spotipy.Spotify | None:
    global _client
    s = get_settings()
    if not (s.spotipy_client_id and s.spotipy_client_secret):
        return None
    if _client is None:
        auth = SpotifyClientCredentials(client_id=s.spotipy_client_id, client_secret=s.spotipy_client_secret)
        _client = spotipy.Spotify(auth_manager=auth, requests_timeout=15)
    return _client


async def _run(fn: Any, *args: Any, **kwargs: Any) -> Any:
    return await asyncio.to_thread(fn, *args, **kwargs)


async def search_track(artist: str, title: str) -> dict[str, Any] | None:
    client = _get_client()
    if client is None:
        return None
    key = f"search:{artist.lower()}:{title.lower()}"
    if key in _cache:
        return _cache[key]  # type: ignore[no-any-return]
    try:
        q = f'track:"{title}" artist:"{artist}"'
        data = await _run(client.search, q=q, limit=1, type="track")
        items = data.get("tracks", {}).get("items", [])
        result = items[0] if items else None
        _cache[key] = result
        return result
    except (spotipy.SpotifyException, httpx.HTTPError) as e:
        log.warning("spotify search_track failed: %s", e)
        return None


async def audio_features(spotify_id: str) -> dict[str, Any] | None:
    client = _get_client()
    if client is None or not spotify_id:
        return None
    key = f"features:{spotify_id}"
    if key in _cache:
        return _cache[key]  # type: ignore[no-any-return]
    try:
        data = await _run(client.audio_features, [spotify_id])
        result = data[0] if data else None
        _cache[key] = result
        return result
    except (spotipy.SpotifyException, httpx.HTTPError) as e:
        log.warning("spotify audio_features failed: %s", e)
        return None


async def features_for(artist: str, title: str) -> dict[str, Any] | None:
    """Combined search → features helper."""
    track = await search_track(artist, title)
    if not track:
        return None
    feats = await audio_features(track["id"])
    if not feats:
        return None
    # Strip noise; keep only the music-genome-relevant fields
    return {
        "bpm": feats.get("tempo"),
        "key": feats.get("key"),
        "mode": feats.get("mode"),
        "energy": feats.get("energy"),
        "valence": feats.get("valence"),
        "danceability": feats.get("danceability"),
        "acousticness": feats.get("acousticness"),
        "instrumentalness": feats.get("instrumentalness"),
        "liveness": feats.get("liveness"),
        "loudness": feats.get("loudness"),
        "speechiness": feats.get("speechiness"),
        "spotify_id": track["id"],
        "isrc": track.get("external_ids", {}).get("isrc"),
        "preview_url": track.get("preview_url"),
        "artwork_url": (track.get("album", {}).get("images") or [{}])[0].get("url"),
    }
