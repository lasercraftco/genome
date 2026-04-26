"""DJ Console integration — Tyler's existing DJ Console analyzer has
audio-feature vectors for tracks already in his library. Cross-link enables:
- 'Find similar to track I own' (full feature vector available)
- 'Auto-queue stem extraction' for danceable tracks added via Genome

Implementation is gated on DJ Console actually being deployed. The Postgres
instance is shared; we'll read DJ Console's `tracks` table directly when
it exists."""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

log = logging.getLogger(__name__)


async def lookup_features(session: AsyncSession, artist: str, title: str) -> dict[str, Any] | None:
    """Return the analyzer's feature row for a track, if DJ Console has it."""
    try:
        row = (await session.execute(
            text(
                "SELECT bpm, key_camelot, energy, lufs, duration_ms "
                "FROM dj.tracks "
                "WHERE LOWER(artist)=LOWER(:a) AND LOWER(title)=LOWER(:t) "
                "LIMIT 1"
            ),
            {"a": artist, "t": title},
        )).mappings().first()
    except Exception as e:  # noqa: BLE001
        log.debug("dj-console lookup skipped (schema not present?): %s", e)
        return None
    return dict(row) if row else None


async def queue_stem_extraction(session: AsyncSession, artist: str, title: str, path: str) -> bool:
    """Insert a stem-extraction job into DJ Console's job queue."""
    try:
        await session.execute(
            text(
                "INSERT INTO dj.stem_jobs (artist, title, file_path, status, created_at) "
                "VALUES (:a, :t, :p, 'pending', NOW()) "
                "ON CONFLICT DO NOTHING"
            ),
            {"a": artist, "t": title, "p": path},
        )
        return True
    except Exception as e:  # noqa: BLE001
        log.debug("dj-console queue skipped: %s", e)
        return False
