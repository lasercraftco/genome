"""Recommendation engine — turns a station + history into a ranked candidate list.

Pipeline:
  1. CANDIDATE GENERATION — fan out to every discovery source for a generous
     pool of candidate (artist, title) pairs.
  2. ENRICHMENT — pull tags + audio_features (Spotify) + MBIDs in parallel.
  3. SCORING — run every Scorer and combine via per-station weights.
  4. POST-PROCESS — diversity penalty (no 3-in-a-row from same artist),
     deduplicate, exclude already-played, exclude blocked, reserve a 5–10%
     exploration slot.
"""

from __future__ import annotations

import asyncio
import logging
import random
from collections import Counter, defaultdict
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import scorers as scorer_pkg
from app.config import get_settings
from app.models import Feedback, LibraryAdd, Station, StationTrack, Track
from app.services import (
    discogs,
    lastfm,
    listenbrainz,
    musicbrainz,
    reddit,
    spotify,
    youtube_algo,
)
from app.services.llm import deep_rerank, explain

log = logging.getLogger(__name__)


# ---------- top-level entry ----------

async def next_track(
    session: AsyncSession,
    station: Station,
    *,
    deep_think: bool = False,
) -> tuple[dict[str, Any], dict[str, Any]] | None:
    """Pick the next track for a station. Returns (track_dict, explanation_dict)."""
    history = await _played_history(session, station.id, station.user_id, limit=200)
    excluded_ids = {p["track_id"] for p in history[:50]}  # don't repeat last 50
    blocked_artists = await _blocked_artists(session, station.user_id)

    seed = await _seed_dict(session, station)
    candidates = await _candidates(seed, excluded_pairs={(p["artist"], p["title"]) for p in history})
    if not candidates:
        log.warning("no candidates for station %s", station.id)
        return None

    # Filter blocked artists
    candidates = [c for c in candidates if c["artist"].lower() not in blocked_artists]

    # Persist any new candidates as Track rows so they have stable IDs
    candidates = await _ensure_track_rows(session, candidates)

    # De-dupe by (artist, title)
    seen: set[tuple[str, str]] = set()
    unique: list[dict[str, Any]] = []
    for c in candidates:
        key = (c["artist"].lower(), c["title"].lower())
        if key in seen:
            continue
        seen.add(key)
        if c["id"] in excluded_ids:
            continue
        unique.append(c)
    candidates = unique[: get_settings().genome_candidate_pool_size]

    # Build the scoring context (precomputed signals)
    context = await _build_context(seed, candidates, history, deep_think=deep_think)

    weights = _resolve_weights(station)
    scored = await _score_all(seed, candidates, context, weights)

    # Diversity penalty: penalize consecutive same-artist
    last_artists = [h["artist"].lower() for h in history[:3]]
    artist_counts = Counter(last_artists)
    for s in scored:
        a = s["candidate"]["artist"].lower()
        if artist_counts.get(a, 0) >= 1:
            s["score"] *= 0.6
        if artist_counts.get(a, 0) >= 2:
            s["score"] *= 0.3

    scored.sort(key=lambda s: s["score"], reverse=True)

    # Surprise quota — multi-armed bandit slot
    explore = random.random() < station.exploration_ratio
    pick: dict[str, Any]
    if explore and len(scored) > 10:
        pick = random.choice(scored[5:25])
    else:
        pick = scored[0]

    # Generate explanation
    expl = pick["explanation"]
    expl["reason"] = await explain(
        seed={"label": station.seed_label, "type": station.seed_type},
        candidate=pick["candidate"],
        signals=expl,
    )
    expl["sources"] = sorted({src for s in pick["per_scorer"] if s["score"] > 0.0 for src in [s["scorer"]]})
    expl["similarity_score"] = round(pick["score"], 3)

    return pick["candidate"], expl


# ---------- candidate generation ----------

async def _candidates(
    seed: dict[str, Any], excluded_pairs: set[tuple[str, str]]
) -> list[dict[str, Any]]:
    """Fan out to every cheap discovery source for a generous candidate pool."""
    artist = seed.get("artist") or seed.get("label", "")
    title = seed.get("title", "")

    tasks: list[asyncio.Task[list[Any]]] = []
    if seed["type"] == "track":
        tasks.append(asyncio.create_task(_lf_similar_tracks(artist, title)))
        tasks.append(asyncio.create_task(_lb_similar_recordings(seed.get("mbid", ""))))
    if seed["type"] in ("track", "artist"):
        tasks.append(asyncio.create_task(_lf_similar_artists_top_tracks(artist)))
        tasks.append(asyncio.create_task(_reddit_iyl(artist)))
        tasks.append(asyncio.create_task(_yt_radio(artist)))
    if seed["type"] == "tag":
        tasks.append(asyncio.create_task(_lf_top_by_tag(seed.get("label", ""))))

    pool: list[dict[str, Any]] = []
    for batch in await asyncio.gather(*tasks, return_exceptions=True):
        if isinstance(batch, Exception):
            log.debug("candidate batch failed: %s", batch)
            continue
        pool.extend(batch)

    # Filter excluded
    pool = [c for c in pool if (c["artist"].lower(), c["title"].lower()) not in excluded_pairs]
    return pool


async def _lf_similar_tracks(artist: str, title: str) -> list[dict[str, Any]]:
    out = []
    for t in await lastfm.similar_tracks(artist, title, limit=100):
        out.append(
            {
                "artist": (t.get("artist") or {}).get("name", "") if isinstance(t.get("artist"), dict) else str(t.get("artist", "")),
                "title": t.get("name", ""),
                "lastfm_match": float(t.get("match", 0.0) or 0.0),
                "mbid": t.get("mbid") or None,
            }
        )
    return [c for c in out if c["artist"] and c["title"]]


async def _lf_similar_artists_top_tracks(artist: str) -> list[dict[str, Any]]:
    sims = await lastfm.similar_artists(artist, limit=20)
    pool: list[dict[str, Any]] = []
    for sim in sims:
        sim_name = sim.get("name")
        if not sim_name:
            continue
        # Pull a couple top tracks for that artist
        try:
            tracks = await lastfm.top_tracks_by_tag(sim_name, limit=4)
        except Exception:  # noqa: BLE001
            continue
        for t in tracks[:3]:
            pool.append(
                {
                    "artist": sim_name,
                    "title": t.get("name", ""),
                    "lastfm_match": float(sim.get("match", 0.0) or 0.0),
                }
            )
    return pool


async def _lb_similar_recordings(mbid: str) -> list[dict[str, Any]]:
    if not mbid:
        return []
    items = await listenbrainz.similar_recordings(mbid, limit=30)
    out: list[dict[str, Any]] = []
    for item in items:
        if isinstance(item, dict):
            out.append(
                {
                    "artist": item.get("artist_credit_name") or item.get("artist_name", ""),
                    "title": item.get("recording_name") or item.get("name", ""),
                    "mbid": item.get("recording_mbid"),
                    "lb_match": float(item.get("score", 0.0) or 0.0) / 100.0,
                }
            )
    return [c for c in out if c["artist"] and c["title"]]


async def _reddit_iyl(artist: str) -> list[dict[str, Any]]:
    suggestions = await reddit.similar_artists_via_reddit(artist, limit=10)
    out: list[dict[str, Any]] = []
    for sug in suggestions[:10]:
        try:
            tracks = await lastfm.top_tracks_by_tag(sug, limit=2)
        except Exception:  # noqa: BLE001
            tracks = []
        for t in tracks[:1]:
            out.append({"artist": sug, "title": t.get("name", "")})
    return [c for c in out if c["artist"] and c["title"]]


async def _yt_radio(artist: str) -> list[dict[str, Any]]:
    """Use YouTube 'artist radio' as a recommendation source. Cheap; ranked."""
    pairs = await youtube_algo.related_for(artist, "", limit=20)
    return [{"artist": a, "title": t, "yt_rank": i} for i, (a, t) in enumerate(pairs)]


async def _lf_top_by_tag(tag: str) -> list[dict[str, Any]]:
    tracks = await lastfm.top_tracks_by_tag(tag, limit=80)
    return [
        {
            "artist": (t.get("artist") or {}).get("name", "") if isinstance(t.get("artist"), dict) else str(t.get("artist", "")),
            "title": t.get("name", ""),
        }
        for t in tracks
        if t.get("name")
    ]


# ---------- enrichment ----------

async def _build_context(
    seed: dict[str, Any],
    candidates: list[dict[str, Any]],
    history: list[dict[str, Any]],
    *,
    deep_think: bool,
) -> dict[str, Any]:
    """Precompute the cross-cutting signals used by multiple scorers."""
    ctx: dict[str, Any] = {
        "lastfm_similar": {
            (c["artist"].lower(), c["title"].lower()): c.get("lastfm_match", 0.0)
            for c in candidates
            if c.get("lastfm_match")
        },
        "lb_similar": {
            (c["artist"].lower(), c["title"].lower()): c.get("lb_match", 0.0)
            for c in candidates
            if c.get("lb_match")
        },
        "yt_related_rank": {
            (c["artist"].lower(), c["title"].lower()): c.get("yt_rank", 99)
            for c in candidates
            if "yt_rank" in c
        },
        "graph_neighbors": set(),
        "setlist_cohort": set(),
        "transition_prob": _build_markov(history),
        "last_played_id": history[0]["track_id"] if history else None,
        "item2vec_neighbors": {},
        "llm_rerank": {},
    }
    if deep_think:
        ranked_ids = await deep_rerank(
            seed=seed,
            candidates=[
                {"id": c["id"], "artist": c["artist"], "title": c["title"]} for c in candidates[:30]
            ],
            history_summary=_summarize_history(history),
            top_k=15,
        )
        # Convert rank into score
        for i, cid in enumerate(ranked_ids):
            ctx["llm_rerank"][cid] = max(0.1, 1.0 - i / max(len(ranked_ids), 1))
    return ctx


def _build_markov(history: list[dict[str, Any]]) -> dict[str, dict[str, float]]:
    transitions: dict[str, Counter[str]] = defaultdict(Counter)
    for prev, nxt in zip(history[1:], history[:-1], strict=False):
        transitions[prev["track_id"]][nxt["track_id"]] += 1
    return {
        prev: {nxt: cnt / sum(c.values()) for nxt, cnt in c.items()}
        for prev, c in transitions.items()
    }


def _summarize_history(history: list[dict[str, Any]]) -> str:
    if not history:
        return "(new user — no history yet)"
    upvoted = [h for h in history if h.get("feedback") == "up"][:30]
    arts = Counter(h["artist"] for h in upvoted)
    return ", ".join(f"{a} (×{n})" for a, n in arts.most_common(15))


# ---------- scoring ----------

async def _score_all(
    seed: dict[str, Any],
    candidates: list[dict[str, Any]],
    context: dict[str, Any],
    weights: dict[str, float],
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for cand in candidates:
        per_scorer = await asyncio.gather(
            *[s.score(seed, cand, context) for s in scorer_pkg.REGISTERED]
        )
        merged_expl: dict[str, Any] = {}
        per_scorer_payload: list[dict[str, Any]] = []
        total = 0.0
        weight_sum = 0.0
        for scorer, (score, expl) in zip(scorer_pkg.REGISTERED, per_scorer, strict=False):
            w = weights.get(scorer.name, scorer.default_weight)
            total += w * score
            weight_sum += w
            per_scorer_payload.append({"scorer": scorer.name, "score": round(score, 3), "weight": w})
            merged_expl.update(expl)
        out.append(
            {
                "candidate": cand,
                "score": total / weight_sum if weight_sum else 0.0,
                "per_scorer": per_scorer_payload,
                "explanation": merged_expl,
            }
        )
    return out


def _resolve_weights(station: Station) -> dict[str, float]:
    s = get_settings()
    base: dict[str, float] = {
        "content": s.genome_default_feature_weight,
        "tag": s.genome_default_tag_weight,
        "collaborative": s.genome_default_lastfm_weight + s.genome_default_listenbrainz_weight,
        "lyrical": 0.05,
        "graph": 0.05,
        "setlist": 0.03,
        "youtube_algo": 0.05,
        "critic": 0.03,
        "sequence": 0.05,
        "llm": 0.03,
        "item2vec": 0.05,
    }
    base.update(station.weights or {})
    return base


# ---------- DB helpers ----------

async def _seed_dict(session: AsyncSession, station: Station) -> dict[str, Any]:
    seed: dict[str, Any] = {
        "type": station.seed_type,
        "label": station.seed_label,
        "mbid": station.seed_id if station.seed_type in ("track", "artist") else None,
    }
    if station.seed_type == "track":
        track = (await session.execute(select(Track).where(Track.mbid == station.seed_id))).scalar_one_or_none()
        if track:
            seed["artist"] = track.artist
            seed["title"] = track.title
            seed["audio_features"] = track.audio_features
            seed["tags"] = track.tags
    elif station.seed_type == "artist":
        seed["artist"] = station.seed_label
    return seed


async def _played_history(session: AsyncSession, station_id: str, user_id: str, limit: int = 200) -> list[dict[str, Any]]:
    rows = await session.execute(
        select(StationTrack, Track)
        .join(Track, StationTrack.track_id == Track.id)
        .where(StationTrack.station_id == station_id, StationTrack.user_id == user_id)
        .order_by(StationTrack.played_at.desc())
        .limit(limit)
    )
    out: list[dict[str, Any]] = []
    for st, tr in rows.all():
        out.append(
            {
                "track_id": tr.id,
                "artist": tr.artist,
                "title": tr.title,
                "feedback": st.feedback,
                "played_at": st.played_at,
            }
        )
    return out


async def _blocked_artists(session: AsyncSession, user_id: str) -> set[str]:
    rows = await session.execute(
        select(Feedback.track_id).where(Feedback.signal == "block_artist", Feedback.user_id == user_id)
    )
    track_ids = [r[0] for r in rows.all()]
    if not track_ids:
        return set()
    blocked = await session.execute(select(Track.artist).where(Track.id.in_(track_ids)))
    return {a[0].lower() for a in blocked.all()}


async def _ensure_track_rows(session: AsyncSession, candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Look up or insert each candidate as a Track row so it has a stable id."""
    out: list[dict[str, Any]] = []
    for c in candidates:
        if not c.get("artist") or not c.get("title"):
            continue
        existing = (
            await session.execute(
                select(Track).where(Track.artist == c["artist"], Track.title == c["title"])
            )
        ).scalar_one_or_none()
        if existing:
            track_dict = {
                "id": existing.id,
                "artist": existing.artist,
                "title": existing.title,
                "mbid": existing.mbid,
                "audio_features": existing.audio_features or {},
                "tags": existing.tags or [],
                "artwork_url": existing.artwork_url,
            }
        else:
            # Enrich with Spotify features + Last.fm tags
            feats = await spotify.features_for(c["artist"], c["title"])
            tags = await lastfm.top_tags_for_track(c["artist"], c["title"])
            new_track = Track(
                artist=c["artist"],
                title=c["title"],
                mbid=c.get("mbid"),
                audio_features=feats or {},
                tags=tags,
                artwork_url=(feats or {}).get("artwork_url"),
                spotify_id=(feats or {}).get("spotify_id"),
                isrc=(feats or {}).get("isrc"),
            )
            session.add(new_track)
            await session.flush()
            track_dict = {
                "id": new_track.id,
                "artist": new_track.artist,
                "title": new_track.title,
                "mbid": new_track.mbid,
                "audio_features": new_track.audio_features,
                "tags": new_track.tags,
                "artwork_url": new_track.artwork_url,
            }
        track_dict.update({k: v for k, v in c.items() if k not in track_dict and k not in ("artist", "title")})
        out.append(track_dict)
    return out


# ---------- library lookup helper ----------

async def is_in_library(session: AsyncSession, track_id: str) -> tuple[bool, str | None]:
    row = (
        await session.execute(
            select(LibraryAdd).where(LibraryAdd.track_id == track_id).order_by(LibraryAdd.id.desc()).limit(1)
        )
    ).scalar_one_or_none()
    if not row:
        return False, None
    return row.status == "in_library", row.status
