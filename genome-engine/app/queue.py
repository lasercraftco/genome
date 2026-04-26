"""Pre-queue manager — keeps the next N tracks resolved + buffered."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app import recommender
from app.models import Station
from app.sources import resolve_first

log = logging.getLogger(__name__)

PRE_QUEUE_DEPTH = 3


async def next_n(
    session: AsyncSession,
    station: Station,
    *,
    n: int = PRE_QUEUE_DEPTH,
    deep_think: bool = False,
) -> list[dict[str, Any]]:
    """Pick the next N tracks (without persisting their plays) and resolve their stream URLs."""
    picks: list[dict[str, Any]] = []
    skip_ids: set[str] = set()
    for _ in range(n):
        result = await recommender.next_track(session, station, deep_think=deep_think)
        if not result:
            break
        track, expl = result
        if track["id"] in skip_ids:
            continue
        skip_ids.add(track["id"])
        # Resolve stream URL across the multi-source chain
        resolved = await resolve_first(track["artist"], track["title"])
        if not resolved:
            log.warning("no source resolved for %s — %s; skipping", track["artist"], track["title"])
            continue
        picks.append(
            {
                "track": track,
                "stream": resolved.model_dump(),
                "explanation": expl,
            }
        )
    return picks


async def warmup(session: AsyncSession, station: Station) -> list[dict[str, Any]]:
    """Pre-resolve and return."""
    return await next_n(session, station, n=PRE_QUEUE_DEPTH)
