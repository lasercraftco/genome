"""Shared types for source resolvers."""

from __future__ import annotations

from datetime import datetime
from typing import Protocol

from pydantic import BaseModel


class ResolveResult(BaseModel):
    url: str
    expires_at: datetime
    source: str
    source_id: str | None = None
    quality: int = 50  # 0..100, used for failover ordering
    duration_ms: int | None = None
    artwork_url: str | None = None
    title: str | None = None


class Resolver(Protocol):
    name: str
    quality: int

    async def resolve(self, artist: str, title: str) -> ResolveResult | None: ...
