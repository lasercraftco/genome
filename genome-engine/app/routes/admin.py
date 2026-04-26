"""Owner-only admin endpoints — list users, change roles, set quotas, audit log."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import CurrentUser, current_user
from app.db import get_session
from app.models import Feedback, LibraryAdd, Station, User

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _require_owner(user: CurrentUser) -> None:
    if user.role != "owner":
        raise HTTPException(403, "owner only")


@router.get("/users")
async def list_users(
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    _require_owner(user)
    rows = (await session.execute(select(User).order_by(desc(User.created_at)))).scalars().all()
    out: list[dict[str, Any]] = []
    for u in rows:
        st_count = (
            await session.execute(
                select(Station).where(Station.user_id == u.id)
            )
        ).all()
        ups = (
            await session.execute(
                select(Feedback).where(Feedback.user_id == u.id, Feedback.signal == "up")
            )
        ).all()
        out.append(
            {
                "id": u.id,
                "email": u.email,
                "name": u.name,
                "role": u.role,
                "banned": u.banned,
                "auto_approve": u.auto_approve,
                "daily_add_quota": u.daily_add_quota,
                "created_at": u.created_at.isoformat(),
                "last_seen_at": u.last_seen_at.isoformat() if u.last_seen_at else None,
                "stations": len(st_count),
                "upvotes": len(ups),
            }
        )
    return {"users": out}


@router.patch("/users/{user_id}")
async def update_user(
    user_id: str,
    payload: dict[str, Any],
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, str]:
    _require_owner(user)
    target = await session.get(User, user_id)
    if not target:
        raise HTTPException(404, "user not found")
    if "role" in payload and payload["role"] in ("owner", "trusted", "friend", "guest"):
        target.role = payload["role"]
    if "banned" in payload:
        target.banned = bool(payload["banned"])
    if "auto_approve" in payload:
        target.auto_approve = bool(payload["auto_approve"])
    if "daily_add_quota" in payload:
        target.daily_add_quota = int(payload["daily_add_quota"])
    return {"status": "updated"}


@router.get("/audit")
async def audit_log(
    days: int = 14,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    from sqlalchemy import text

    _require_owner(user)
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    rows = (
        await session.execute(
            text(
                "SELECT a.id, a.user_id, u.email AS user_email, a.action, a.target, a.metadata, a.timestamp "
                "FROM audit_log a LEFT JOIN users u ON u.id = a.user_id "
                "WHERE a.timestamp >= :cutoff ORDER BY a.timestamp DESC LIMIT 1000"
            ),
            {"cutoff": cutoff},
        )
    ).mappings().all()
    return {"entries": [dict(r) for r in rows]}
