"""SQLAlchemy ORM — mirrors the Drizzle schema in genome-web/src/lib/db/schema.ts.
Multi-user fields (user_id) included on every per-user table."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


def _uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=_uuid)
    username: Mapped[str] = mapped_column(String(50), unique=True)
    display_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    is_owner: Mapped[bool] = mapped_column(Boolean, default=False)
    email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(800), nullable=True)
    role: Mapped[str] = mapped_column(String(20), default="friend")
    banned: Mapped[bool] = mapped_column(Boolean, default=False)
    auto_approve: Mapped[bool] = mapped_column(Boolean, default=False)
    daily_add_quota: Mapped[int] = mapped_column(Integer, default=10)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    onboarded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    settings: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)


class Station(Base):
    __tablename__ = "stations"

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(40), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    seed_type: Mapped[str] = mapped_column(String(20))
    seed_id: Mapped[str] = mapped_column(String(80))
    seed_label: Mapped[str] = mapped_column(String(300))
    weights: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    exploration_ratio: Mapped[float] = mapped_column(Float, default=0.20)
    pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    auto_add: Mapped[bool] = mapped_column(Boolean, default=False)
    deep_think: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    last_played_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    plays: Mapped[list["StationTrack"]] = relationship(back_populates="station", cascade="all, delete-orphan")


class Track(Base):
    __tablename__ = "tracks"

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=_uuid)
    mbid: Mapped[str | None] = mapped_column(String(40), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(400))
    artist: Mapped[str] = mapped_column(String(300), index=True)
    album: Mapped[str | None] = mapped_column(String(300), nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    isrc: Mapped[str | None] = mapped_column(String(20), nullable=True)
    spotify_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    audio_features: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    tags: Mapped[list[str]] = mapped_column(JSONB, default=list)
    artwork_url: Mapped[str | None] = mapped_column(String(800), nullable=True)
    streaming_url_cached: Mapped[str | None] = mapped_column(Text, nullable=True)
    streaming_url_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source: Mapped[str | None] = mapped_column(String(40), nullable=True)
    source_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    __table_args__ = (UniqueConstraint("artist", "title", name="uq_artist_title"),)


class StationTrack(Base):
    __tablename__ = "station_tracks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    station_id: Mapped[str] = mapped_column(String(40), ForeignKey("stations.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(String(40), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    track_id: Mapped[str] = mapped_column(String(40), ForeignKey("tracks.id"))
    played_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    feedback: Mapped[str | None] = mapped_column(String(10), nullable=True)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    explanation: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)

    station: Mapped[Station] = relationship(back_populates="plays")
    track: Mapped[Track] = relationship(lazy="joined")


class Feedback(Base):
    __tablename__ = "feedback"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(40), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    track_id: Mapped[str] = mapped_column(String(40), ForeignKey("tracks.id"), index=True)
    station_id: Mapped[str | None] = mapped_column(String(40), ForeignKey("stations.id", ondelete="CASCADE"), nullable=True, index=True)
    signal: Mapped[str] = mapped_column(String(10))
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class LibraryAdd(Base):
    __tablename__ = "library_adds"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(40), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    track_id: Mapped[str] = mapped_column(String(40), ForeignKey("tracks.id"), index=True)
    requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    approved_by: Mapped[str | None] = mapped_column(String(40), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    denial_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    lidarr_request_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    playlistdl_request_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="pending")
    downloaded_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
