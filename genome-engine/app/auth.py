"""User context — extracted from headers passed by Next.js middleware.

The web layer authenticates and forwards X-Genome-User-Id / Role / Email
to the engine. The engine trusts those headers because:
  - the engine binds to 127.0.0.1 only (per docker-compose.yml)
  - only the web container in the same docker network reaches it
  - Cloudflare Tunnel sits in front of the web layer, not the engine

So every request must carry user context (anonymous calls fail).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from fastapi import Header, HTTPException

Role = Literal["owner", "trusted", "friend", "guest"]


@dataclass
class CurrentUser:
    id: str
    email: str
    role: Role


async def current_user(
    x_genome_user_id: str | None = Header(default=None),
    x_genome_user_role: str | None = Header(default=None),
    x_genome_user_email: str | None = Header(default=None),
) -> CurrentUser:
    if not x_genome_user_id:
        raise HTTPException(401, "missing user context")
    role = (x_genome_user_role or "friend").lower()
    if role not in ("owner", "trusted", "friend", "guest"):
        role = "friend"
    return CurrentUser(id=x_genome_user_id, email=x_genome_user_email or "", role=role)  # type: ignore[arg-type]


def can_direct_add(user: CurrentUser) -> bool:
    return user.role in ("owner", "trusted")
