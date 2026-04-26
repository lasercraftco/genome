"""Scorer interface."""

from __future__ import annotations

from typing import Any, Protocol


class Scorer(Protocol):
    name: str
    default_weight: float

    async def score(
        self,
        seed: dict[str, Any],
        candidate: dict[str, Any],
        context: dict[str, Any],
    ) -> tuple[float, dict[str, Any]]:
        """Return (score in [0,1], explanation_dict).

        seed: {label, type, mbid, audio_features, tags, ...}
        candidate: {id, artist, title, mbid, audio_features, tags, ...}
        context: {history: [...], session: [...], session_features: [...], etc}
        """
        ...
