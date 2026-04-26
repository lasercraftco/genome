"""Centralized settings — reads from env, validates with pydantic."""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    database_url: str = Field(default="postgres://genome:genome@localhost:5432/genome")

    # Discovery sources
    lastfm_api_key: str = ""
    lastfm_api_secret: str = ""
    listenbrainz_user: str = "tyler702702"
    listenbrainz_token: str = ""
    spotipy_client_id: str = ""
    spotipy_client_secret: str = ""
    musicbrainz_user_agent: str = "Genome/0.1 (genome.tyflix.net)"

    # Library wire
    lidarr_url: str = "http://host.docker.internal:8686"
    lidarr_api_key: str = ""
    playlist_dl_url: str = "http://host.docker.internal:8800"
    navidrome_url: str = "http://host.docker.internal:4533"
    plex_url: str = "http://host.docker.internal:32400"
    plex_token: str = ""

    # Tuning defaults
    genome_default_feature_weight: float = 0.35
    genome_default_tag_weight: float = 0.25
    genome_default_lastfm_weight: float = 0.25
    genome_default_listenbrainz_weight: float = 0.15
    genome_exploration_ratio: float = 0.20
    genome_candidate_pool_size: int = 200

    # yt-dlp
    ytdlp_cache_ttl_seconds: int = 18000
    ytdlp_concurrent_resolves: int = 4

    # General
    log_level: str = "info"


@lru_cache
def get_settings() -> Settings:
    return Settings()
