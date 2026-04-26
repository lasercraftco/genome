"""YouTube via yt-dlp — primary streaming source. Largest catalog."""

from __future__ import annotations

from app.sources._ytdlp_helpers import ytdlp_resolve
from app.sources.base import ResolveResult


class YouTubeResolver:
    name = "youtube"
    quality = 95

    async def resolve(self, artist: str, title: str) -> ResolveResult | None:
        return await ytdlp_resolve(
            artist, title, source=self.name, search_prefix="ytsearch", quality=self.quality
        )


resolver = YouTubeResolver()
