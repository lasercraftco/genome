"""LLM rerank — gated behind per-station 'deep_think' flag. Adds an
Anthropic-grounded score over the top-K candidates from other scorers."""

from __future__ import annotations

from typing import Any


class LLMScorer:
    name = "llm"
    default_weight = 0.03

    async def score(
        self,
        seed: dict[str, Any],
        candidate: dict[str, Any],
        context: dict[str, Any],
    ) -> tuple[float, dict[str, Any]]:
        # context['llm_rerank'] is precomputed: dict[candidate_id → score]
        rerank: dict[str, float] = context.get("llm_rerank", {})
        s = float(rerank.get(candidate["id"], 0.0))
        return s, ({"llm_rerank": round(s, 3)} if s > 0 else {})
