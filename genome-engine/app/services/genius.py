"""Genius — lyrics fetch + a lightweight TF-IDF vector for lyrical similarity.

We avoid full sentence-transformer dependency at runtime; instead we cache
TF-IDF vectors keyed by (artist|title) and compute cosine on demand. Works
well for our scale and avoids a 400MB model download."""

from __future__ import annotations

import logging
import math
import os
import re
from collections import Counter
from typing import Any

import httpx
from cachetools import TTLCache
from tenacity import retry, stop_after_attempt, wait_exponential

log = logging.getLogger(__name__)
_lyrics_cache: TTLCache[str, str | None] = TTLCache(maxsize=4096, ttl=60 * 60 * 24 * 30)
_vector_cache: TTLCache[str, dict[str, float]] = TTLCache(maxsize=4096, ttl=60 * 60 * 24 * 30)
_search_cache: TTLCache[str, str | None] = TTLCache(maxsize=4096, ttl=60 * 60 * 24 * 30)

_TOKEN = os.environ.get("GENIUS_TOKEN", "")
_STOPWORDS = set(
    "the a an and or but of to in on at for with from by is are was were be been being "
    "i you he she we they it me him her us them my your his hers our their this that these those "
    "as if so than then no not".split()
)


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8), reraise=True)
async def _genius_search(artist: str, title: str) -> str | None:
    key = f"{artist.lower()}|{title.lower()}"
    if key in _search_cache:
        return _search_cache[key]
    if not _TOKEN:
        return None
    headers = {"Authorization": f"Bearer {_TOKEN}"}
    try:
        async with httpx.AsyncClient(timeout=10, headers=headers) as c:
            r = await c.get(
                "https://api.genius.com/search", params={"q": f"{artist} {title}"}
            )
        r.raise_for_status()
        hits = r.json().get("response", {}).get("hits", [])
        if not hits:
            _search_cache[key] = None
            return None
        path = hits[0]["result"]["path"]
        url = f"https://genius.com{path}"
        _search_cache[key] = url
        return url
    except httpx.HTTPError:
        _search_cache[key] = None
        return None


async def fetch_lyrics(artist: str, title: str) -> str | None:
    key = f"{artist.lower()}|{title.lower()}"
    if key in _lyrics_cache:
        return _lyrics_cache[key]
    url = await _genius_search(artist, title)
    if not url:
        _lyrics_cache[key] = None
        return None
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as c:
            r = await c.get(url, headers={"User-Agent": "Genome/0.1"})
        body = r.text
        # Genius pages embed lyrics in <div data-lyrics-container="true">…</div> blocks
        chunks = re.findall(r'<div data-lyrics-container="true"[^>]*>(.*?)</div>', body, re.S)
        text = "\n".join(re.sub(r"<[^>]+>", " ", c) for c in chunks)
        text = re.sub(r"\s+", " ", text).strip()
        _lyrics_cache[key] = text or None
        return _lyrics_cache[key]
    except httpx.HTTPError:
        _lyrics_cache[key] = None
        return None


def _tokenize(text: str) -> list[str]:
    tokens = re.findall(r"[a-z']+", text.lower())
    return [t for t in tokens if t not in _STOPWORDS and len(t) > 2]


async def lyrical_vector(artist: str, title: str) -> dict[str, float]:
    """Returns a TF vector (we treat it as TF-IDF with implicit IDF=1 for now)."""
    key = f"{artist.lower()}|{title.lower()}"
    if key in _vector_cache:
        return _vector_cache[key]
    lyrics = await fetch_lyrics(artist, title)
    if not lyrics:
        _vector_cache[key] = {}
        return {}
    tokens = _tokenize(lyrics)
    counts = Counter(tokens)
    total = sum(counts.values()) or 1
    vec = {tok: cnt / total for tok, cnt in counts.most_common(200)}
    _vector_cache[key] = vec
    return vec


def cosine(a: dict[str, float], b: dict[str, float]) -> float:
    if not a or not b:
        return 0.0
    common = set(a) & set(b)
    if not common:
        return 0.0
    dot = sum(a[t] * b[t] for t in common)
    na = math.sqrt(sum(v * v for v in a.values()))
    nb = math.sqrt(sum(v * v for v in b.values()))
    return dot / (na * nb) if na and nb else 0.0
