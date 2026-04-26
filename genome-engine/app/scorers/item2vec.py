"""Item2Vec — skip-gram embedding over Tyler's listening sessions.

We compute embeddings offline (or lazily on a daily refresh) and stash them
in `context['item2vec_neighbors']` as { candidate_id → similarity }."""

from __future__ import annotations

from typing import Any


class Item2VecScorer:
    name = "item2vec"
    default_weight = 0.03

    async def score(
        self,
        seed: dict[str, Any],
        candidate: dict[str, Any],
        context: dict[str, Any],
    ) -> tuple[float, dict[str, Any]]:
        neighbors: dict[str, float] = context.get("item2vec_neighbors", {})
        s = float(neighbors.get(candidate["id"], 0.0))
        return s, ({"item2vec": round(s, 3)} if s > 0 else {})
