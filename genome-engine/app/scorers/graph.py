"""Graph walks — MusicBrainz artist relationships. Boost candidates that
share label, producer, or era with the seed."""

from __future__ import annotations

from typing import Any


class GraphWalkScorer:
    name = "graph"
    default_weight = 0.05

    async def score(
        self,
        seed: dict[str, Any],
        candidate: dict[str, Any],
        context: dict[str, Any],
    ) -> tuple[float, dict[str, Any]]:
        # context['graph_neighbors'] is a precomputed set of (artist|title) keys
        # the candidate generator put together (same label, era, producer).
        neighbors: set[str] = context.get("graph_neighbors", set())
        key = f"{candidate.get('artist', '').lower()}|{candidate.get('title', '').lower()}"
        if key in neighbors:
            return 0.7, {"graph_match": True}
        return 0.0, {}
