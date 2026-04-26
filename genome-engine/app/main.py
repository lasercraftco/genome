"""FastAPI entrypoint."""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.config import get_settings
from app.routes import admin, feedback, health, history, library, play, search, smart, stations, tracks

logging.basicConfig(level=getattr(logging, get_settings().log_level.upper(), logging.INFO))


app = FastAPI(
    title="Genome — engine",
    version=__version__,
    description="Self-hosted Pandora-style music discovery (recommendation + streaming).",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(search.router)
app.include_router(stations.router)
app.include_router(history.router)
app.include_router(play.router)
app.include_router(feedback.router)
app.include_router(library.router)
app.include_router(tracks.router)
app.include_router(smart.router)
app.include_router(admin.router)


@app.get("/")
async def root() -> dict[str, str]:
    return {
        "service": "genome-engine",
        "version": __version__,
        "docs": "/docs",
    }
