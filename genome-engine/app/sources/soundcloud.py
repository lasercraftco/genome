"""SoundCloud via yt-dlp — great fallback, lots of remixes + DJ uploads."""

from __future__ import annotations

from app.sources._ytdlp_helpers import ytdlp_resolve
from app.sources.base import ResolveResult


class SoundCloudResolver:
    name = "soundcloud"
    quality = 80

    async def resolve(self, artist: str, title: str) -> ResolveResult | None:
        return await ytdlp_resolve(
            artist, title, source=self.name, search_prefix="scsearch", quality=self.quality
        )


resolver = SoundCloudResolver()
