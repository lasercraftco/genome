"""Setlist co-occurrence — Setlist.fm + Songkick. Artists that play the same
events / festivals / venues together share an aesthetic."""

from __future__ import annotations

from typing import Any


class SetlistScorer:
    name = "setlist"
    default_weight = 0.03

    async def score(
        self,
        seed: dict[str, Any],
        candidate: dict[str, Any],
        context: dict[str, Any],
    ) -> tuple[float, dict[str, Any]]:
        cohort: set[str] = context.get("setlist_cohort", set())
        artist = (candidate.get("artist") or "").lower()
        if artist in cohort:
            return 0.6, {"setlist_cohort": True}
        return 0.0, {}
