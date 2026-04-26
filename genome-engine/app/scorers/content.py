"""Content-based scorer — cosine similarity on the audio-feature vector
plus Camelot key compatibility."""

from __future__ import annotations

from typing import Any

from app.scorers._math import camelot_compatible, cosine, feature_vector


class ContentScorer:
    name = "content"
    default_weight = 0.30

    async def score(
        self,
        seed: dict[str, Any],
        candidate: dict[str, Any],
        context: dict[str, Any],
    ) -> tuple[float, dict[str, Any]]:
        sf = seed.get("audio_features") or {}
        cf = candidate.get("audio_features") or {}
        if not sf or not cf:
            return 0.0, {}
        sim = cosine(feature_vector(sf), feature_vector(cf))
        camelot = camelot_compatible(sf.get("key"), sf.get("mode"), cf.get("key"), cf.get("mode"))
        score = 0.85 * sim + 0.15 * camelot
        return score, {
            "feature_similarity": round(sim, 3),
            "camelot_compatibility": round(camelot, 2),
            "feature_breakdown": {
                k: round(cf.get(k, 0.0) or 0.0, 3) for k in ("bpm", "energy", "valence", "danceability")
            },
        }
