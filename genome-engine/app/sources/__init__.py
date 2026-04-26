"""Source resolver chain — turns a (artist, title) into a streamable URL.

Resolvers are tried in priority order. Each resolver caches its own
hits and remembers misses (so we don't keep retrying a failed source for
the same track within a TTL).

To add a new source:
    1. Create app/sources/<name>.py exposing a `resolver: Resolver` instance
    2. Add it to RESOLVERS below
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from typing import TYPE_CHECKING

from app.sources.audius import resolver as audius_resolver
from app.sources.bandcamp import resolver as bandcamp_resolver
from app.sources.ccmixter import resolver as ccmixter_resolver
from app.sources.fma import resolver as fma_resolver
from app.sources.hearthis import resolver as hearthis_resolver
from app.sources.internet_archive import resolver as ia_resolver
from app.sources.jamendo import resolver as jamendo_resolver
from app.sources.mixcloud import resolver as mixcloud_resolver
from app.sources.soundcloud import resolver as soundcloud_resolver
from app.sources.youtube import resolver as youtube_resolver

if TYPE_CHECKING:
    from app.sources.base import ResolveResult, Resolver

log = logging.getLogger(__name__)


# Order matters — higher-quality + better-coverage sources first.
RESOLVERS: list["Resolver"] = [
    youtube_resolver,
    soundcloud_resolver,
    bandcamp_resolver,
    mixcloud_resolver,
    audius_resolver,
    hearthis_resolver,
    ia_resolver,
    fma_resolver,
    jamendo_resolver,
    ccmixter_resolver,
]


async def resolve_first(artist: str, title: str) -> "ResolveResult | None":
    """Try each resolver in order; return the first hit."""
    for r in RESOLVERS:
        try:
            result = await r.resolve(artist, title)
        except Exception as e:  # noqa: BLE001
            log.warning("resolver %s crashed for %s - %s: %s", r.name, artist, title, e)
            continue
        if result:
            log.info("resolved %s - %s via %s", artist, title, r.name)
            return result
    log.warning("all resolvers failed for %s - %s", artist, title)
    return None


async def resolve_all(artist: str, title: str) -> AsyncIterator["ResolveResult"]:
    """Yield every resolver's hit (for failover stack-up)."""
    for r in RESOLVERS:
        try:
            result = await r.resolve(artist, title)
            if result:
                yield result
        except Exception as e:  # noqa: BLE001
            log.warning("resolver %s crashed: %s", r.name, e)
