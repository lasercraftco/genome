"""Collaborative filtering: Last.fm `track.getSimilar` + ListenBrainz CF."""

from __future__ import annotations

from typing import Any


class CollaborativeScorer:
    name = "collaborative"
    default_weight = 0.25

    async def score(
        self,
        seed: dict[str, Any],
        candidate: dict[str, Any],
        context: dict[str, Any],
    ) -> tuple[float, dict[str, Any]]:
        # context['lastfm_similar'] is precomputed: { (artist, title) → match_score }
        lf = context.get("lastfm_similar", {})
        lb = context.get("lb_similar", {})
        key = (candidate.get("artist", "").lower(), candidate.get("title", "").lower())
        s_lf = float(lf.get(key, 0.0))
        s_lb = float(lb.get(key, 0.0))
        score = max(s_lf, s_lb)
        sources = []
        if s_lf > 0:
            sources.append("lastfm.similar")
        if s_lb > 0:
            sources.append("listenbrainz.cf")
        return score, {"lastfm_rank": round(s_lf, 3), "listenbrainz_rank": round(s_lb, 3), "sources": sources}
