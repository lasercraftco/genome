"""Liveness + readiness."""

from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import text

from app import __version__
from app.db import session_scope

router = APIRouter()


@router.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok", "version": __version__}


@router.get("/readyz")
async def readyz() -> dict[str, str]:
    try:
        async with session_scope() as s:
            await s.execute(text("select 1"))
        return {"status": "ready"}
    except Exception as e:  # noqa: BLE001
        return {"status": "not_ready", "error": str(e)}
