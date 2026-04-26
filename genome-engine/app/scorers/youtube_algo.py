"""YouTube algorithm signal — uses 'artist radio' YouTube mix as a soft
recommendation source. Cheap and surprisingly accurate."""

from __future__ import annotations

from typing import Any


class YouTubeAlgoScorer:
    name = "youtube_algo"
    default_weight = 0.05

    async def score(
        self,
        seed: dict[str, Any],
        candidate: dict[str, Any],
        context: dict[str, Any],
    ) -> tuple[float, dict[str, Any]]:
        related: dict[tuple[str, str], int] = context.get("yt_related_rank", {})
        key = (candidate.get("artist", "").lower(), candidate.get("title", "").lower())
        rank = related.get(key)
        if rank is None:
            return 0.0, {}
        return max(0.0, 1.0 - rank / 30.0), {"yt_radio_rank": rank}
