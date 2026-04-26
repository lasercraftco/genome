"""Tag-based — Jaccard similarity on the union of tag sets from
Last.fm + MusicBrainz + Discogs (and AllMusic when available)."""

from __future__ import annotations

from typing import Any

from app.scorers._math import jaccard


class TagScorer:
    name = "tag"
    default_weight = 0.20

    async def score(
        self,
        seed: dict[str, Any],
        candidate: dict[str, Any],
        context: dict[str, Any],
    ) -> tuple[float, dict[str, Any]]:
        s_tags = {t.lower() for t in (seed.get("tags") or [])}
        c_tags = {t.lower() for t in (candidate.get("tags") or [])}
        sim = jaccard(s_tags, c_tags)
        overlap = sorted(s_tags & c_tags)[:5]
        return sim, {"tag_overlap": overlap}
