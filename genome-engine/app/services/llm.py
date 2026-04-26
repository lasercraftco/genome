"""Anthropic-backed 'deep think' scorer + natural-language explanation generator.

Gated behind a per-station 'deep_think' flag because each call costs money/time.
Used for:
  1. Re-ranking the top-K candidates with reasoning over Tyler's history
  2. Generating the 'Why this song?' natural-language sentence
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

import httpx
from cachetools import TTLCache

log = logging.getLogger(__name__)

_ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
_MODEL = os.environ.get("GENOME_LLM_MODEL", "claude-haiku-4-5-20251001")
_explain_cache: TTLCache[str, str] = TTLCache(maxsize=2048, ttl=60 * 60 * 24 * 30)


async def explain(seed: dict[str, Any], candidate: dict[str, Any], signals: dict[str, Any]) -> str:
    """1-2 sentence natural-language explanation grounded in the actual signals."""
    if not _ANTHROPIC_KEY:
        return _fallback_explanation(seed, candidate, signals)
    cache_key = json.dumps(
        {"seed": seed, "cand": candidate.get("id"), "sig": list(signals)}, sort_keys=True
    )
    if cache_key in _explain_cache:
        return _explain_cache[cache_key]
    prompt = (
        "You are explaining a music recommendation in 1-2 sentences. Be specific about WHY.\n\n"
        f"Seed: {seed.get('label')} ({seed.get('type')})\n"
        f"Candidate: {candidate.get('artist')} — {candidate.get('title')}\n"
        f"Signals: {json.dumps(signals, default=str)[:1200]}\n\n"
        "Reply with one short sentence in plain language. No 'Because' prefix."
    )
    try:
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": _ANTHROPIC_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": _MODEL,
                    "max_tokens": 120,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
        r.raise_for_status()
        text: str = r.json()["content"][0]["text"].strip()
        _explain_cache[cache_key] = text
        return text
    except (httpx.HTTPError, KeyError, IndexError) as e:
        log.debug("llm explain failed: %s", e)
        return _fallback_explanation(seed, candidate, signals)


def _fallback_explanation(seed: dict[str, Any], candidate: dict[str, Any], signals: dict[str, Any]) -> str:
    parts: list[str] = []
    if signals.get("lastfm_rank"):
        parts.append(f"Last.fm fans of {seed.get('label')} love this")
    if signals.get("tag_overlap"):
        tags = ", ".join(signals["tag_overlap"][:3])
        parts.append(f"shares the {tags} vibe")
    if signals.get("feature_similarity") is not None:
        sim = signals["feature_similarity"]
        if sim > 0.85:
            parts.append("nearly identical tempo + energy")
        elif sim > 0.7:
            parts.append("similar tempo and feel")
    if not parts:
        return f"Closely related to {seed.get('label')}"
    return ". ".join(p[0].upper() + p[1:] for p in parts) + "."


async def deep_rerank(
    seed: dict[str, Any],
    candidates: list[dict[str, Any]],
    history_summary: str,
    top_k: int = 10,
) -> list[str]:
    """Return reranked list of candidate IDs (top-K only). Falls back to identity order."""
    if not _ANTHROPIC_KEY or not candidates:
        return [c["id"] for c in candidates]
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": _ANTHROPIC_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": _MODEL,
                    "max_tokens": 400,
                    "messages": [
                        {
                            "role": "user",
                            "content": (
                                "You are reranking music recommendations.\n"
                                f"Seed: {seed.get('label')}\n"
                                f"User taste summary: {history_summary[:1500]}\n\n"
                                "Candidates (id | artist — title):\n"
                                + "\n".join(
                                    f"{c['id']} | {c.get('artist')} — {c.get('title')}"
                                    for c in candidates[:30]
                                )
                                + "\n\nReply with a JSON array of the top "
                                f"{top_k} candidate IDs in order, no prose. Example: [\"id1\",\"id2\",...]"
                            ),
                        }
                    ],
                },
            )
        r.raise_for_status()
        text = r.json()["content"][0]["text"].strip()
        # Handle accidental markdown fences
        text = text.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        ids: list[str] = json.loads(text)
        return [i for i in ids if i in {c["id"] for c in candidates}][:top_k]
    except (httpx.HTTPError, json.JSONDecodeError, KeyError, IndexError) as e:
        log.debug("llm deep_rerank failed: %s", e)
        return [c["id"] for c in candidates[:top_k]]
