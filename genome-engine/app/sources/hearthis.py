"""Hearthis.at — DJ/electronic focus. yt-dlp supports it."""

from __future__ import annotations

from app.sources._ytdlp_helpers import ytdlp_resolve
from app.sources.base import ResolveResult


class HearthisResolver:
    name = "hearthis"
    quality = 55

    async def resolve(self, artist: str, title: str) -> ResolveResult | None:
        # yt-dlp doesn't expose a search:// for hearthis, so we try the canonical URL pattern
        slug_artist = artist.lower().replace(" ", "-")
        slug_title = title.lower().replace(" ", "-")
        url = f"https://hearthis.at/{slug_artist}/{slug_title}/"
        return await ytdlp_resolve(artist, title, source=self.name, search_prefix=None, quality=self.quality)


resolver = HearthisResolver()
