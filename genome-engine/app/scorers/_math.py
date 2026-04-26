"""Shared math helpers."""

from __future__ import annotations

import math
from typing import Sequence


_FEATURE_KEYS = (
    "bpm",
    "energy",
    "valence",
    "danceability",
    "acousticness",
    "instrumentalness",
    "liveness",
    "speechiness",
    "loudness",
)


def _normalize(name: str, value: float | None) -> float:
    if value is None:
        return 0.5  # null-bias toward middle
    if name == "bpm":
        return max(0.0, min(1.0, (value - 60) / (200 - 60)))
    if name == "loudness":  # typically -60..0 dB
        return max(0.0, min(1.0, (value + 60) / 60))
    return max(0.0, min(1.0, float(value)))


def feature_vector(features: dict[str, float | None]) -> list[float]:
    return [_normalize(k, features.get(k)) for k in _FEATURE_KEYS]


def cosine(a: Sequence[float], b: Sequence[float]) -> float:
    if not a or not b:
        return 0.0
    dot = sum(x * y for x, y in zip(a, b, strict=False))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0


def jaccard(a: set[str], b: set[str]) -> float:
    if not a and not b:
        return 0.0
    return len(a & b) / max(1, len(a | b))


def camelot_compatible(key_a: int | None, mode_a: int | None, key_b: int | None, mode_b: int | None) -> float:
    """1.0 if perfect Camelot match, 0.5 if neighbour, 0.0 else."""
    if None in (key_a, mode_a, key_b, mode_b):
        return 0.5
    # Camelot wheel: convert pitch-class + mode to wheel position
    def wheel(k: int, m: int) -> tuple[int, int]:
        # mode 1=major, 0=minor
        major_map = {0: 8, 1: 3, 2: 10, 3: 5, 4: 12, 5: 7, 6: 2, 7: 9, 8: 4, 9: 11, 10: 6, 11: 1}
        minor_map = {k: v - 3 if v - 3 > 0 else v + 9 for k, v in major_map.items()}
        n = major_map[k] if m == 1 else minor_map[k]
        return n, m
    na, ma = wheel(int(key_a), int(mode_a))
    nb, mb = wheel(int(key_b), int(mode_b))
    if na == nb and ma == mb:
        return 1.0
    if ma == mb and abs(na - nb) in (1, 11):
        return 0.7
    if na == nb and ma != mb:
        return 0.7
    return 0.2
