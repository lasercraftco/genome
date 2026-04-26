"""DEPRECATED — use app.sources.* instead. Kept as a thin shim during Phase 3."""

from __future__ import annotations

from app.sources import resolve_first


async def resolve_stream(artist: str, title: str) -> dict[str, object] | None:
    result = await resolve_first(artist, title)
    if not result:
        return None
    return result.model_dump()
