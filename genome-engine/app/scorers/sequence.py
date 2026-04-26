"""Markov chain over Tyler's listening sessions. 'What comes after a track
like this in a real session?' Built incrementally from his scrobble history
+ Genome's own play history."""

from __future__ import annotations

from typing import Any


class SequenceScorer:
    name = "sequence"
    default_weight = 0.03

    async def score(
        self,
        seed: dict[str, Any],
        candidate: dict[str, Any],
        context: dict[str, Any],
    ) -> tuple[float, dict[str, Any]]:
        # context['transition_prob'] is a precomputed dict: prev_track_id → { next_track_id → prob }
        last_id = context.get("last_played_id")
        if not last_id:
            return 0.0, {}
        probs: dict[str, float] = context.get("transition_prob", {}).get(last_id, {})
        p = probs.get(candidate["id"], 0.0)
        return min(1.0, p * 4), ({"transition_p": round(p, 3)} if p > 0 else {})
