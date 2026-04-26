"""Critic + popularity bias — Pitchfork Best New Music + AOTY scores.
Gentle bonus for editorial-flagged tracks; never dominant."""

from __future__ import annotations

from typing import Any


class CriticScorer:
    name = "critic"
    default_weight = 0.03

    async def score(
        self,
        seed: dict[str, Any],
        candidate: dict[str, Any],
        context: dict[str, Any],
    ) -> tuple[float, dict[str, Any]]:
        meta = candidate.get("editorial") or {}
        score = 0.0
        notes: list[str] = []
        if meta.get("pitchfork_bnm"):
            score += 0.5
            notes.append("Pitchfork Best New Music")
        pf = meta.get("pitchfork_score")
        if pf is not None:
            score = max(score, float(pf) / 10.0)
            notes.append(f"Pitchfork {pf}")
        aoty = meta.get("aoty_score")
        if aoty is not None:
            score = max(score, float(aoty) / 100.0)
            notes.append(f"AOTY {aoty}")
        return min(1.0, score), ({"editorial": notes} if notes else {})
