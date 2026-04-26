"""Lyrical similarity — Genius lyrics → TF vector → cosine. Soft signal,
gated on lyrics being available; otherwise neutral 0.0."""

from __future__ import annotations

from typing import Any

from app.services.genius import cosine, lyrical_vector


class LyricalScorer:
    name = "lyrical"
    default_weight = 0.05

    async def score(
        self,
        seed: dict[str, Any],
        candidate: dict[str, Any],
        context: dict[str, Any],
    ) -> tuple[float, dict[str, Any]]:
        seed_artist = seed.get("artist") or seed.get("label", "")
        seed_title = seed.get("title", "")
        if not seed_title:
            return 0.0, {}
        sv = await lyrical_vector(seed_artist, seed_title)
        cv = await lyrical_vector(candidate.get("artist", ""), candidate.get("title", ""))
        sim = cosine(sv, cv)
        return sim, {"lyrical_similarity": round(sim, 3)} if sim > 0 else (0.0, {})
