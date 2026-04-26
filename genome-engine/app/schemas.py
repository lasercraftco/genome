"""Pydantic models for API I/O."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


# ---------- common ----------

class TrackOut(BaseModel):
    id: str
    mbid: str | None = None
    title: str
    artist: str
    album: str | None = None
    duration_ms: int | None = None
    artwork_url: str | None = None
    audio_features: dict[str, Any] = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)
    source: str | None = None
    in_library: bool = False
    library_status: str | None = None  # 'pending' | 'downloading' | 'in_library' | None


# ---------- search ----------

class SearchResult(BaseModel):
    kind: Literal["artist", "track", "tag"]
    id: str
    label: str
    sublabel: str | None = None
    artwork_url: str | None = None
    mbid: str | None = None


class SearchResponse(BaseModel):
    query: str
    results: list[SearchResult]


# ---------- stations ----------

class CreateStationRequest(BaseModel):
    seed_type: Literal["artist", "track", "tag"]
    seed_id: str
    seed_label: str
    name: str | None = None


class StationOut(BaseModel):
    id: str
    name: str
    seed_type: str
    seed_id: str
    seed_label: str
    weights: dict[str, float] = Field(default_factory=dict)
    exploration_ratio: float = 0.20
    pinned: bool = False
    auto_add: bool = False
    created_at: datetime
    last_played_at: datetime | None = None


class StationListOut(BaseModel):
    stations: list[StationOut]


# ---------- play ----------

class WhyExplanation(BaseModel):
    """Music Genome–style explanation surfaced to the user."""

    reason: str  # human readable
    sources: list[str] = Field(default_factory=list)  # 'lastfm.similar' | 'listenbrainz.cf' etc
    similarity_score: float | None = None
    tag_overlap: list[str] = Field(default_factory=list)
    feature_breakdown: dict[str, float] = Field(default_factory=dict)


class NowPlayingTrack(BaseModel):
    track: TrackOut
    stream_url: str
    stream_url_expires_at: datetime
    station_id: str
    queue_position: int
    explanation: WhyExplanation


# ---------- feedback ----------

class FeedbackRequest(BaseModel):
    track_id: str
    station_id: str | None = None
    signal: Literal["up", "down", "skip", "block_artist"]


# ---------- library ----------

class LibraryAddRequest(BaseModel):
    track_id: str


class LibraryAddOut(BaseModel):
    track_id: str
    status: str
    lidarr_request_id: int | None = None
    playlistdl_request_id: str | None = None
    downloaded_path: str | None = None
    error: str | None = None


# ---------- weights ----------

class WeightsUpdate(BaseModel):
    feature_weight: float | None = None
    tag_weight: float | None = None
    lastfm_weight: float | None = None
    listenbrainz_weight: float | None = None
    exploration_ratio: float | None = None
    auto_add: bool | None = None
